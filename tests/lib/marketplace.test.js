// In-memory Redis so recorded plans can be read back
const mockStore = new Map();
jest.mock('../../lib/redis', () => ({
  get: jest.fn(async (key) => (mockStore.has(key) ? mockStore.get(key) : null)),
  set: jest.fn(async (key, value, options = {}) => {
    if (options.nx && mockStore.has(key)) return null;
    mockStore.set(key, value);
    return 'OK';
  }),
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

      expect(result).toEqual({ account: { id: '77', login: 'acme', type: 'Organization' }, changed: true, current: true });
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

  describe('events with the same effective_date', () => {
    const DATE = '2026-12-01T00:00:00+00:00';

    test('cancelled wins over purchased in either delivery order', async () => {
      await applyPurchaseEvent(purchaseEvent('cancelled', PAID_PLAN, DATE), { deliveryId: 'a' });
      const late = await applyPurchaseEvent(purchaseEvent('purchased', PAID_PLAN, DATE), { deliveryId: 'b' });
      expect(late).toMatchObject({ changed: false, current: false });
      expect(await getMarketplaceTier('77')).toBe('free');

      mockStore.clear();
      await applyPurchaseEvent(purchaseEvent('purchased', PAID_PLAN, DATE), { deliveryId: 'b' });
      expect(await getMarketplaceTier('77')).toBe('paid');
      const cancelled = await applyPurchaseEvent(purchaseEvent('cancelled', PAID_PLAN, DATE), { deliveryId: 'a' });
      expect(cancelled.changed).toBe(true);
      expect(await getMarketplaceTier('77')).toBe('free');
    });

    test('a redelivered purchased cannot re-grant a cancellation dated the same', async () => {
      const purchased = purchaseEvent('purchased', PAID_PLAN, DATE);
      await applyPurchaseEvent(purchased, { deliveryId: 'p' });
      await applyPurchaseEvent(purchaseEvent('cancelled', PAID_PLAN, DATE), { deliveryId: 'c' });
      await applyPurchaseEvent(purchased, { deliveryId: 'p' });
      expect(await getMarketplaceTier('77')).toBe('free');
    });

    test('changed wins over purchased, and cancelled over changed', async () => {
      await applyPurchaseEvent(purchaseEvent('changed', PAID_PLAN, DATE), { deliveryId: 'a' });
      await applyPurchaseEvent(purchaseEvent('purchased', FREE_PLAN, DATE), { deliveryId: 'z' });
      expect(await getMarketplaceTier('77')).toBe('paid');
      await applyPurchaseEvent(purchaseEvent('cancelled', PAID_PLAN, DATE), { deliveryId: 'a' });
      expect(await getMarketplaceTier('77')).toBe('free');
    });

    test('the higher delivery id breaks a tie between the same action, in either order', async () => {
      const toPaid = purchaseEvent('changed', PAID_PLAN, DATE);
      const toFree = purchaseEvent('changed', FREE_PLAN, DATE);

      await applyPurchaseEvent(toPaid, { deliveryId: '00000000-b' });
      expect((await applyPurchaseEvent(toFree, { deliveryId: '00000000-a' })).changed).toBe(false);
      expect(await getMarketplaceTier('77')).toBe('paid');

      mockStore.clear();
      await applyPurchaseEvent(toFree, { deliveryId: '00000000-a' });
      expect((await applyPurchaseEvent(toPaid, { deliveryId: '00000000-b' })).changed).toBe(true);
      expect(await getMarketplaceTier('77')).toBe('paid');
    });

    test('a replay writes nothing but is reported as the current plan', async () => {
      const redis = require('../../lib/redis');
      const event = purchaseEvent('cancelled', PAID_PLAN, DATE);
      await applyPurchaseEvent(purchaseEvent('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00'), { deliveryId: 'p' });
      expect(await applyPurchaseEvent(event, { deliveryId: 'c' })).toMatchObject({ changed: true, current: true });
      const before = { ...mockStore.get('marketplace:77') };

      expect(await applyPurchaseEvent(event, { deliveryId: 'c' })).toMatchObject({ changed: false, current: true });
      expect(mockStore.get('marketplace:77')).toEqual(before);
      expect(redis.hset).not.toHaveBeenCalled();
    });

    test('a pending change dated the same as the changed that carried it out is ignored', async () => {
      await applyPurchaseEvent(purchaseEvent('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00'));
      await applyPurchaseEvent(purchaseEvent('changed', FREE_PLAN, DATE), { deliveryId: 'a' });
      // A late or redelivered announcement of that change
      await applyPurchaseEvent(purchaseEvent('pending_change', FREE_PLAN, DATE), { deliveryId: 'z' });
      expect(mockStore.get('marketplace:77')).toMatchObject({ planId: '9000', pendingPlanId: '' });
    });

    test('a pending change dated the same as the purchase is recorded', async () => {
      await applyPurchaseEvent(purchaseEvent('purchased', PAID_PLAN, DATE), { deliveryId: 'z' });
      await applyPurchaseEvent(purchaseEvent('pending_change', FREE_PLAN, DATE), { deliveryId: 'a' });
      expect(mockStore.get('marketplace:77')).toMatchObject({ planId: '9001', pendingPlanId: '9000' });
    });
  });

  describe('reconciliation with GitHub', () => {
    const redis = require('../../lib/redis');
    // GET /marketplace_listing/accounts/77: the purchase, or null for a 404
    const listing = (plan, updatedAt = '2026-11-01T00:00:00Z', extra = {}) => ({
      id: 77,
      login: 'acme',
      marketplace_purchase: { billing_cycle: 'monthly', on_free_trial: false, updated_at: updatedAt, plan, ...extra },
    });
    const markerTtl = () => {
      const calls = redis.set.mock.calls.filter(([key]) => key === 'marketplace-checked:77');
      return calls[calls.length - 1][2].ex;
    };

    test('a missing record is looked up: a purchase GitHub reports is recorded', async () => {
      const lookup = jest.fn(async () => listing(PAID_PLAN, '2026-11-01T00:00:00Z', { on_free_trial: true }));
      expect(await getMarketplaceTier('77', lookup)).toBe('paid');
      expect(lookup).toHaveBeenCalledWith('77');
      expect(mockStore.get('marketplace:77')).toMatchObject({
        account: 'acme', planId: '9001', planName: 'Paid', onFreeTrial: 'true',
        effectiveAt: String(Date.parse('2026-11-01T00:00:00Z')),
      });
      expect(markerTtl()).toBe(24 * 60 * 60);

      // Checked: no more lookups for a day
      expect(await getMarketplaceTier('77', lookup)).toBe('paid');
      expect(lookup).toHaveBeenCalledTimes(1);
    });

    test('a 404 is free, records nothing and is re-checked after 10 minutes', async () => {
      const lookup = jest.fn(async () => null);
      expect(await getMarketplaceTier('77', lookup)).toBe('free');
      expect(mockStore.has('marketplace:77')).toBe(false);
      expect(markerTtl()).toBe(10 * 60);
      expect(await getMarketplaceTier('77', lookup)).toBe('free');
      expect(lookup).toHaveBeenCalledTimes(1);

      // The marker expires; GitHub now reports a purchase whose webhook was missed
      mockStore.delete('marketplace-checked:77');
      lookup.mockResolvedValueOnce(listing(PAID_PLAN));
      expect(await getMarketplaceTier('77', lookup)).toBe('paid');
    });

    test('a failed lookup serves the recorded tier, is held for a minute only, and is retried', async () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      const lookup = jest.fn(async () => { throw new Error('GitHub is down'); });
      expect(await getMarketplaceTier('77', lookup)).toBe('free');
      expect(error).toHaveBeenCalled();
      expect(mockStore.get('marketplace-checked:77')).toBe('checking');
      expect(markerTtl()).toBe(60);

      mockStore.delete('marketplace-checked:77'); // a minute later
      lookup.mockResolvedValueOnce(listing(PAID_PLAN));
      expect(await getMarketplaceTier('77', lookup)).toBe('paid');
      error.mockRestore();
    });

    test('concurrent reads make one lookup', async () => {
      let release;
      const held = new Promise(resolve => { release = resolve; });
      const lookup = jest.fn(async () => { await held; return listing(PAID_PLAN); });
      const first = getMarketplaceTier('77', lookup);
      const second = getMarketplaceTier('77', lookup);
      expect(await second).toBe('free');
      release();
      expect(await first).toBe('paid');
      expect(lookup).toHaveBeenCalledTimes(1);
    });

    test('a webhook newer than the reconciled plan wins', async () => {
      await getMarketplaceTier('77', async () => listing(PAID_PLAN, '2026-11-01T00:00:00Z'));
      const result = await applyPurchaseEvent(purchaseEvent('cancelled', PAID_PLAN, '2026-12-01T00:00:00+00:00'));
      expect(result.changed).toBe(true);
      expect(await getMarketplaceTier('77')).toBe('free');
    });

    test('a webhook dated the same as the reconciled plan wins', async () => {
      await getMarketplaceTier('77', async () => listing(PAID_PLAN, '2026-11-01T00:00:00Z'));
      const result = await applyPurchaseEvent(purchaseEvent('purchased', FREE_PLAN, '2026-11-01T00:00:00Z'));
      expect(result.changed).toBe(true);
      expect(await getMarketplaceTier('77')).toBe('free');
    });

    test('what GitHub reports cannot override a newer webhook', async () => {
      await applyPurchaseEvent(purchaseEvent('cancelled', PAID_PLAN, '2026-12-01T00:00:00+00:00'));
      // The API still shows the purchase it replaced
      expect(await getMarketplaceTier('77', async () => listing(PAID_PLAN, '2026-11-01T00:00:00Z'))).toBe('free');
      expect(mockStore.get('marketplace:77').planId).toBe('');
    });

    test('a newer plan GitHub reports replaces a missed change', async () => {
      await applyPurchaseEvent(purchaseEvent('purchased', FREE_PLAN, '2026-11-01T00:00:00+00:00'));
      expect(await getMarketplaceTier('77', async () => listing(PAID_PLAN, '2026-11-10T00:00:00Z'))).toBe('paid');
      expect(markerTtl()).toBe(24 * 60 * 60);
    });

    test('a recorded plan GitHub no longer reports is a missed cancellation', async () => {
      await applyPurchaseEvent(purchaseEvent('purchased', PAID_PLAN, new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()));
      expect(await getMarketplaceTier('77', async () => null)).toBe('free');
      expect(mockStore.get('marketplace:77')).toMatchObject({ planId: '', planName: '' });
      expect(markerTtl()).toBe(24 * 60 * 60);
    });

    test('a purchase from just before the lookup is kept if GitHub does not show it yet', async () => {
      await applyPurchaseEvent(purchaseEvent('purchased', PAID_PLAN, new Date(Date.now() - 5 * 60 * 1000).toISOString()));
      expect(await getMarketplaceTier('77', async () => null)).toBe('paid');
    });

    test('no lookup without mapped plans', async () => {
      delete process.env.GITHUB_MARKETPLACE_PLANS;
      const lookup = jest.fn();
      expect(await getMarketplaceTier('77', lookup)).toBe('free');
      expect(lookup).not.toHaveBeenCalled();
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
