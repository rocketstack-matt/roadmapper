// In-memory Redis so recorded plans can be read back
const mockStore = new Map();
jest.mock('../../lib/redis', () => ({
  get: jest.fn(async (key) => (mockStore.has(key) ? mockStore.get(key) : null)),
  set: jest.fn(async (key, value) => { mockStore.set(key, value); return 'OK'; }),
  del: jest.fn(async (key) => (mockStore.delete(key) ? 1 : 0)),
  hgetall: jest.fn(async (key) => (mockStore.has(key) ? { ...mockStore.get(key) } : null)),
  hset: jest.fn(async (key, fields) => { mockStore.set(key, { ...(mockStore.get(key) || {}), ...fields }); return 1; }),
  eval: jest.fn(async (script, keys, args) => require('../redis-lua').evalLua(mockStore, script, keys, args)),
}));

const {
  higherTier,
  planTier,
  isMarketplaceConfigured,
  getMarketplaceTier,
  applyPurchaseEvent,
  getMarketplaceUrl,
} = require('../../lib/marketplace');

const PAID_PLAN = { id: 9001, name: 'Paid' };
const FREE_PLAN = { id: 9000, name: 'Free' };

const purchaseEvent = (action, plan, effectiveDate, extra = {}) => ({
  action,
  effective_date: effectiveDate,
  marketplace_purchase: {
    account: { type: 'Organization', id: 77, login: 'acme' },
    billing_cycle: 'monthly',
    on_free_trial: false,
    plan,
    ...extra,
  },
});

const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  process.env = { ...originalEnv, GITHUB_MARKETPLACE_PLANS: '{"9001":"paid","9000":"free"}' };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('lib/marketplace', () => {
  describe('higherTier', () => {
    test('paid beats free either way round', () => {
      expect(higherTier('free', 'paid')).toBe('paid');
      expect(higherTier('paid', 'free')).toBe('paid');
      expect(higherTier('free', 'free')).toBe('free');
    });
  });

  describe('planTier', () => {
    test('maps a plan by id', () => {
      expect(planTier('9001', 'Renamed')).toBe('paid');
      expect(planTier(9000, 'Free')).toBe('free');
    });

    test('falls back to the plan name', () => {
      process.env.GITHUB_MARKETPLACE_PLANS = '{"Pro":"paid"}';
      expect(planTier('1', 'Pro')).toBe('paid');
    });

    test('an unknown plan, or none, is free', () => {
      expect(planTier('1234', 'Enterprise')).toBe('free');
      expect(planTier('', '')).toBe('free');
    });

    test('an unknown tier in the mapping is free', () => {
      process.env.GITHUB_MARKETPLACE_PLANS = '{"9001":"platinum"}';
      expect(planTier('9001', 'Paid')).toBe('free');
    });

    test('unset or invalid config maps every plan to free', () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      delete process.env.GITHUB_MARKETPLACE_PLANS;
      expect(planTier('9001', 'Paid')).toBe('free');
      expect(isMarketplaceConfigured()).toBe(false);
      process.env.GITHUB_MARKETPLACE_PLANS = '{not json';
      expect(planTier('9001', 'Paid')).toBe('free');
      process.env.GITHUB_MARKETPLACE_PLANS = '["paid"]';
      expect(planTier('0', 'paid')).toBe('free');
      error.mockRestore();
    });
  });

  describe('applyPurchaseEvent', () => {
    test('purchased records the plan and the account gets its tier', async () => {
      const result = await applyPurchaseEvent(purchaseEvent('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00'));

      expect(result).toEqual({ account: { id: '77', login: 'acme', type: 'Organization' }, changed: true });
      expect(mockStore.get('marketplace:77')).toMatchObject({ account: 'acme', planId: '9001', planName: 'Paid', onFreeTrial: 'false' });
      expect(await getMarketplaceTier('77')).toBe('paid');
    });

    test('a free trial of a paid plan is paid', async () => {
      await applyPurchaseEvent(purchaseEvent('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00', { on_free_trial: true }));
      expect(mockStore.get('marketplace:77').onFreeTrial).toBe('true');
      expect(await getMarketplaceTier('77')).toBe('paid');
    });

    test('changed moves the account to the new plan', async () => {
      await applyPurchaseEvent(purchaseEvent('purchased', FREE_PLAN, '2026-11-01T00:00:00+00:00'));
      expect(await getMarketplaceTier('77')).toBe('free');
      await applyPurchaseEvent(purchaseEvent('changed', PAID_PLAN, '2026-11-02T00:00:00+00:00'));
      expect(await getMarketplaceTier('77')).toBe('paid');
    });

    test('cancelled drops the account to free', async () => {
      await applyPurchaseEvent(purchaseEvent('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00'));
      const result = await applyPurchaseEvent(purchaseEvent('cancelled', PAID_PLAN, '2026-12-01T00:00:00+00:00'));

      expect(result.changed).toBe(true);
      expect(mockStore.get('marketplace:77')).toMatchObject({ planId: '', planName: '' });
      expect(await getMarketplaceTier('77')).toBe('free');
    });

    test('pending_change keeps the current tier until the cycle ends', async () => {
      await applyPurchaseEvent(purchaseEvent('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00'));
      const result = await applyPurchaseEvent(purchaseEvent('pending_change', FREE_PLAN, '2026-12-01T00:00:00+00:00'));

      expect(result.changed).toBe(false);
      expect(mockStore.get('marketplace:77')).toMatchObject({ planId: '9001', pendingPlanId: '9000', pendingPlanName: 'Free' });
      expect(await getMarketplaceTier('77')).toBe('paid');

      // GitHub sends changed when the downgrade takes effect
      await applyPurchaseEvent(purchaseEvent('changed', FREE_PLAN, '2026-12-01T00:00:00+00:00'));
      expect(mockStore.get('marketplace:77')).toMatchObject({ planId: '9000', pendingPlanId: '', pendingAt: '' });
      expect(await getMarketplaceTier('77')).toBe('free');
    });

    test('pending_change_cancelled clears the pending change and keeps the plan', async () => {
      await applyPurchaseEvent(purchaseEvent('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00'));
      await applyPurchaseEvent(purchaseEvent('pending_change', FREE_PLAN, '2026-12-01T00:00:00+00:00'));
      const result = await applyPurchaseEvent(purchaseEvent('pending_change_cancelled', PAID_PLAN, '2026-12-01T00:00:00+00:00'));

      expect(result.changed).toBe(false);
      expect(mockStore.get('marketplace:77')).toMatchObject({ planId: '9001', pendingPlanId: '', pendingAt: '' });
      expect(await getMarketplaceTier('77')).toBe('paid');
    });

    test('an event older than the recorded plan is ignored', async () => {
      await applyPurchaseEvent(purchaseEvent('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00'));
      await applyPurchaseEvent(purchaseEvent('cancelled', PAID_PLAN, '2026-12-01T00:00:00+00:00'));

      // A late (or redelivered) purchase can't re-grant the cancelled plan
      const result = await applyPurchaseEvent(purchaseEvent('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00'));
      expect(result.changed).toBe(false);
      expect(await getMarketplaceTier('77')).toBe('free');

      // Nor can a stale pending change
      await applyPurchaseEvent(purchaseEvent('pending_change', FREE_PLAN, '2026-11-15T00:00:00+00:00'));
      expect(mockStore.get('marketplace:77').pendingPlanId).toBe('');
    });

    test('re-applying the same event changes nothing', async () => {
      const event = purchaseEvent('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00');
      await applyPurchaseEvent(event);
      const before = { ...mockStore.get('marketplace:77') };
      await applyPurchaseEvent(event);
      expect(mockStore.get('marketplace:77')).toEqual(before);
    });

    test('two concurrent deliveries in reverse order leave the newer one applied', async () => {
      const redis = require('../../lib/redis');
      const purchased = purchaseEvent('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00');
      const cancelled = purchaseEvent('cancelled', PAID_PLAN, '2026-12-01T00:00:00+00:00');

      const [late, early] = await Promise.all([applyPurchaseEvent(cancelled), applyPurchaseEvent(purchased)]);
      expect(late.changed).toBe(true);
      expect(early.changed).toBe(false);
      // The ordering check and the write are one script, never a read then a write
      expect(redis.eval).toHaveBeenCalledTimes(2);
      expect(redis.hgetall).not.toHaveBeenCalled();
      expect(redis.hset).not.toHaveBeenCalled();
      expect(await getMarketplaceTier('77')).toBe('free');
    });

    test('the newer delivery wins when the older one is handled first, even interleaved', async () => {
      const redis = require('../../lib/redis');
      // Hold the older delivery's script until the newer one has run, as two
      // webhook invocations racing would
      let release;
      const held = new Promise(resolve => { release = resolve; });
      const run = redis.eval.getMockImplementation();
      redis.eval.mockImplementationOnce(async (...args) => { await held; return run(...args); });

      const older = applyPurchaseEvent(purchaseEvent('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00'));
      await applyPurchaseEvent(purchaseEvent('cancelled', PAID_PLAN, '2026-12-01T00:00:00+00:00'));
      release();
      expect((await older).changed).toBe(false);
      expect(mockStore.get('marketplace:77').planId).toBe('');
      expect(await getMarketplaceTier('77')).toBe('free');
    });

    test('an unknown plan is recorded but grants free', async () => {
      await applyPurchaseEvent(purchaseEvent('purchased', { id: 5555, name: 'Mystery' }, '2026-11-01T00:00:00+00:00'));
      expect(mockStore.get('marketplace:77').planId).toBe('5555');
      expect(await getMarketplaceTier('77')).toBe('free');
    });

    test('a mapping change applies to recorded plans', async () => {
      await applyPurchaseEvent(purchaseEvent('purchased', { id: 5555, name: 'Mystery' }, '2026-11-01T00:00:00+00:00'));
      process.env.GITHUB_MARKETPLACE_PLANS = '{"5555":"paid"}';
      expect(await getMarketplaceTier('77')).toBe('paid');
    });

    test('an undated event cannot override a dated one', async () => {
      await applyPurchaseEvent(purchaseEvent('cancelled', PAID_PLAN, '2026-12-01T00:00:00+00:00'));
      await applyPurchaseEvent(purchaseEvent('purchased', PAID_PLAN, undefined));
      expect(await getMarketplaceTier('77')).toBe('free');
    });

    test('ignores other actions and payloads without an account', async () => {
      expect(await applyPurchaseEvent(purchaseEvent('refunded', PAID_PLAN, '2026-11-01'))).toBeNull();
      expect(await applyPurchaseEvent({ action: 'purchased' })).toBeNull();
      expect(mockStore.size).toBe(0);
    });
  });

  describe('getMarketplaceTier', () => {
    test('free without an account or a recorded plan', async () => {
      expect(await getMarketplaceTier(undefined)).toBe('free');
      expect(await getMarketplaceTier('77')).toBe('free');
    });
  });

  describe('getMarketplaceUrl', () => {
    test('the listing URL once the App slug and plans are set', () => {
      process.env.GITHUB_APP_SLUG = 'roadmapper';
      expect(getMarketplaceUrl()).toBe('https://github.com/marketplace/roadmapper');
    });

    test('null without plans or a slug', () => {
      delete process.env.GITHUB_APP_SLUG;
      expect(getMarketplaceUrl()).toBeNull();
      process.env.GITHUB_APP_SLUG = 'roadmapper';
      delete process.env.GITHUB_MARKETPLACE_PLANS;
      expect(getMarketplaceUrl()).toBeNull();
    });
  });
});
