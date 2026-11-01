const crypto = require('crypto');
const { Readable } = require('stream');

// In-memory Redis, so the webhook's effects on install mappings and caches
// can be read back
const mockStore = new Map();
jest.mock('../lib/redis', () => ({
  get: jest.fn(async (key) => (mockStore.has(key) ? mockStore.get(key) : null)),
  set: jest.fn(async (key, value) => { mockStore.set(key, value); return 'OK'; }),
  del: jest.fn(async (key) => (mockStore.delete(key) ? 1 : 0)),
  hgetall: jest.fn(async (key) => (mockStore.has(key) ? { ...mockStore.get(key) } : null)),
  hset: jest.fn(async (key, fields) => { mockStore.set(key, { ...(mockStore.get(key) || {}), ...fields }); return 1; }),
}));

const webhookHandler = require('../api/webhook');
const { verifySignature } = require('../api/webhook');

const SECRET = 'webhook-secret';
const sign = (body, secret = SECRET) => `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;

// A request whose body arrives on the stream, as on Vercel and Express
const createWebhookReq = (event, payload, { signature, method = 'POST', raw } = {}) => {
  const body = raw !== undefined ? raw : JSON.stringify(payload);
  const req = Readable.from([Buffer.from(body)]);
  req.method = method;
  req.url = '/api/webhook';
  req.headers = {
    'x-github-event': event,
    'x-hub-signature-256': signature !== undefined ? signature : sign(body),
    'content-type': 'application/json',
  };
  return req;
};

const createRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(body) { res.body = body; return res; },
  };
  return res;
};

const send = async (event, payload, options) => {
  const res = createRes();
  await webhookHandler(createWebhookReq(event, payload, options), res);
  return res;
};

const installation = { id: 42, account: { login: 'owner' } };
const repository = { full_name: 'owner/repo', name: 'repo', owner: { login: 'owner' }, private: false };
const roadmapLabel = { name: 'Roadmap: Now', color: '2da44e' };
const otherLabel = { name: 'bug', color: 'd73a4a' };
const issuePayload = (action, labels, extra = {}) => ({
  action,
  installation: { id: 42 },
  repository,
  issue: { number: 1, title: 'A', labels },
  ...extra,
});

const cacheIssues = () => {
  mockStore.set('cache:issues:owner/repo', JSON.stringify({ issues: [], etag: null, cachedAt: Date.now() }));
};
const setTier = (tier) => mockStore.set('installation:42', { account: 'owner', repos: '["owner/repo"]', tier });

const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  process.env = { ...originalEnv, GITHUB_APP_WEBHOOK_SECRET: SECRET, VERCEL_ENV: 'production' };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('api/webhook', () => {
  describe('signature verification', () => {
    test('accepts a valid signature', async () => {
      const res = await send('ping', { zen: 'Keep it simple.' });
      expect(res.statusCode).toBe(200);
    });

    test('rejects a missing signature', async () => {
      const res = await send('ping', {}, { signature: '' });
      expect(res.statusCode).toBe(401);
    });

    test('rejects a signature made with the wrong secret', async () => {
      const body = JSON.stringify({});
      const res = await send('ping', {}, { signature: sign(body, 'other-secret') });
      expect(res.statusCode).toBe(401);
    });

    test('rejects a body changed after signing', async () => {
      const signature = sign(JSON.stringify({ action: 'opened' }));
      const res = await send('ping', {}, { signature, raw: JSON.stringify({ action: 'deleted' }) });
      expect(res.statusCode).toBe(401);
    });

    test('verifies the raw bytes, not re-serialized JSON', async () => {
      const raw = '{ "zen" : "spaced \\u003c out" }';
      const res = await send('ping', null, { raw, signature: sign(raw) });
      expect(res.statusCode).toBe(200);
    });

    test('rejects a signature without the sha256= prefix', () => {
      const body = Buffer.from('{}');
      const hex = sign(body).slice('sha256='.length);
      expect(verifySignature(SECRET, body, hex)).toBe(false);
      expect(verifySignature(SECRET, body, undefined)).toBe(false);
    });

    test('returns 503 when no webhook secret is configured', async () => {
      delete process.env.GITHUB_APP_WEBHOOK_SECRET;
      const res = await send('ping', {});
      expect(res.statusCode).toBe(503);
    });

    test('returns 405 for non-POST requests', async () => {
      const res = await send('ping', {}, { method: 'GET' });
      expect(res.statusCode).toBe(405);
    });

    test('returns 400 for a signed body that is not JSON', async () => {
      const res = await send('ping', null, { raw: 'not json' });
      expect(res.statusCode).toBe(400);
    });

    test('ignores unhandled events', async () => {
      const res = await send('star', { action: 'created' });
      expect(res.body).toEqual({ result: 'ignored' });
    });
  });

  describe('installation events', () => {
    test('created maps the installation\'s public repos', async () => {
      const res = await send('installation', {
        action: 'created',
        installation,
        repositories: [{ full_name: 'owner/repo', private: false }, { full_name: 'owner/secret', private: true }],
      });

      expect(res.body).toEqual({ result: 'updated' });
      expect(mockStore.get('install:owner/repo')).toBe('42');
      expect(mockStore.has('install:owner/secret')).toBe(false);
      expect(JSON.parse(mockStore.get('installation:42').repos)).toEqual(['owner/repo']);
    });

    test('deleted forgets the installation and its repos', async () => {
      setTier('paid');
      mockStore.set('install:owner/repo', '42');
      mockStore.set('repo:owner/repo', { tier: 'paid', source: 'app' });

      await send('installation', { action: 'deleted', installation, repositories: [{ full_name: 'owner/repo' }] });

      expect(mockStore.has('install:owner/repo')).toBe(false);
      expect(mockStore.has('repo:owner/repo')).toBe(false);
      expect(mockStore.has('installation:42')).toBe(false);
    });

    test('suspend unmaps the repos but keeps the installation\'s tier', async () => {
      setTier('paid');
      mockStore.set('install:owner/repo', '42');

      await send('installation', { action: 'suspend', installation });

      expect(mockStore.has('install:owner/repo')).toBe(false);
      expect(mockStore.get('installation:42').tier).toBe('paid');
    });

    test('installation_repositories added and removed update the mapping', async () => {
      await send('installation_repositories', {
        action: 'added',
        installation,
        repositories_added: [{ full_name: 'owner/repo', private: false }, { full_name: 'owner/secret', private: true }],
        repositories_removed: [],
      });
      expect(mockStore.get('install:owner/repo')).toBe('42');
      expect(mockStore.has('install:owner/secret')).toBe(false);

      await send('installation_repositories', {
        action: 'removed',
        installation,
        repositories_added: [],
        repositories_removed: [{ full_name: 'owner/repo' }],
      });
      expect(mockStore.has('install:owner/repo')).toBe(false);
      expect(JSON.parse(mockStore.get('installation:42').repos)).toEqual([]);
    });
  });

  describe('repository events', () => {
    test('privatized forgets the repo so it is re-verified, and drops its cache', async () => {
      mockStore.set('install:owner/repo', '42');
      mockStore.set('visibility:owner/repo', 'public');
      mockStore.set('repo:owner/repo', { tier: 'paid', source: 'app' });
      mockStore.set('repo-ttl:owner/repo', '1');
      cacheIssues();

      const res = await send('repository', { action: 'privatized', installation, repository: { ...repository, private: true } });

      expect(res.body).toEqual({ result: 'updated' });
      expect(mockStore.has('install:owner/repo')).toBe(false);
      expect(mockStore.has('repo:owner/repo')).toBe(false);
      expect(mockStore.has('repo-ttl:owner/repo')).toBe(false);
      expect(mockStore.has('visibility:owner/repo')).toBe(false);
      expect(mockStore.has('cache:issues:owner/repo')).toBe(false);
    });

    test('uses lowercased keys for canonically-cased repo names', async () => {
      mockStore.set('install:owner/repo', '42');
      await send('repository', { action: 'privatized', installation, repository: { ...repository, full_name: 'Owner/Repo' } });
      expect(mockStore.has('install:owner/repo')).toBe(false);
    });

    test('renamed also forgets the old name', async () => {
      mockStore.set('install:owner/old', '42');
      await send('repository', {
        action: 'renamed',
        installation,
        repository,
        changes: { repository: { name: { from: 'old' } } },
      });
      expect(mockStore.has('install:owner/old')).toBe(false);
    });

    test('transferred also forgets the old owner\'s name', async () => {
      mockStore.set('install:previous/repo', '42');
      await send('repository', {
        action: 'transferred',
        installation,
        repository,
        changes: { owner: { from: { organization: { login: 'previous' } } } },
      });
      expect(mockStore.has('install:previous/repo')).toBe(false);
    });

    test('ignores other repository actions', async () => {
      mockStore.set('install:owner/repo', '42');
      const res = await send('repository', { action: 'starred', installation, repository });
      expect(res.body).toEqual({ result: 'ignored' });
      expect(mockStore.get('install:owner/repo')).toBe('42');
    });
  });

  describe('issues events', () => {
    beforeEach(() => {
      setTier('paid');
      cacheIssues();
    });

    test.each(['opened', 'edited', 'closed', 'reopened', 'labeled', 'unlabeled', 'deleted'])(
      '%s on a roadmap issue invalidates a paid repo\'s cache',
      async (action) => {
        const res = await send('issues', issuePayload(action, [roadmapLabel]));

        expect(res.body).toEqual({ result: 'invalidated' });
        expect(mockStore.has('cache:issues:owner/repo')).toBe(false);
        expect(Number(mockStore.get('cache:invalidated:owner/repo'))).toBeGreaterThan(0);
      }
    );

    test('unlabeled for the roadmap label itself invalidates', async () => {
      const res = await send('issues', issuePayload('unlabeled', [otherLabel], { label: roadmapLabel }));
      expect(res.body).toEqual({ result: 'invalidated' });
    });

    test('transferred invalidates the old and new repos', async () => {
      const res = await send('issues', issuePayload('transferred', [roadmapLabel], {
        changes: { new_repository: { full_name: 'owner/other' } },
      }));
      expect(res.body).toEqual({ result: 'invalidated' });
      expect(mockStore.has('cache:invalidated:owner/repo')).toBe(true);
      expect(mockStore.has('cache:invalidated:owner/other')).toBe(true);
    });

    test('ignores issues without roadmap labels', async () => {
      const res = await send('issues', issuePayload('edited', [otherLabel], { label: otherLabel }));
      expect(res.body).toEqual({ result: 'ignored' });
      expect(mockStore.has('cache:issues:owner/repo')).toBe(true);
    });

    test('ignores actions that cannot change the roadmap', async () => {
      const res = await send('issues', issuePayload('assigned', [roadmapLabel]));
      expect(res.body).toEqual({ result: 'ignored' });
    });

    test('leaves a free installation on its soft TTL', async () => {
      setTier('free');
      const res = await send('issues', issuePayload('edited', [roadmapLabel]));
      expect(res.body).toEqual({ result: 'ignored' });
      expect(mockStore.has('cache:issues:owner/repo')).toBe(true);
    });

    test('invalidates a repo with a paid key in a free installation', async () => {
      setTier('free');
      mockStore.set('repo:owner/repo', { tier: 'paid', source: 'app' });
      const res = await send('issues', issuePayload('edited', [roadmapLabel]));
      expect(res.body).toEqual({ result: 'invalidated' });
    });

    test('a stale fetch finishing after the webhook is not cached as fresh', async () => {
      const { cacheIssues: storeIssues, getCachedIssues, isCacheFresh } = require('../lib/cache');
      const fetchedAt = Date.now() - 1000; // a fetch that started before the change

      await send('issues', issuePayload('edited', [roadmapLabel]));
      await storeIssues('owner', 'repo', [], 900, null, fetchedAt);

      expect(isCacheFresh(await getCachedIssues('owner', 'repo'), 900)).toBe(false);
    });

    test('returns 500 when Redis fails, so the delivery can be retried', async () => {
      const redis = require('../lib/redis');
      redis.del.mockRejectedValueOnce(new Error('Redis down'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await send('issues', issuePayload('edited', [roadmapLabel]));

      expect(res.statusCode).toBe(500);
      console.error.mockRestore();
    });
  });

  describe('label events', () => {
    beforeEach(() => {
      setTier('paid');
      cacheIssues();
    });

    test('editing a roadmap label invalidates', async () => {
      const res = await send('label', { action: 'edited', installation: { id: 42 }, repository, label: roadmapLabel });
      expect(res.body).toEqual({ result: 'invalidated' });
    });

    test('renaming a label away from a roadmap name invalidates', async () => {
      const res = await send('label', {
        action: 'edited',
        installation: { id: 42 },
        repository,
        label: { name: 'Shipped' },
        changes: { name: { from: 'Roadmap: Now' } },
      });
      expect(res.body).toEqual({ result: 'invalidated' });
    });

    test('deleting a group label invalidates', async () => {
      const res = await send('label', {
        action: 'deleted',
        installation: { id: 42 },
        repository,
        label: { name: 'Roadmap Group: API' },
      });
      expect(res.body).toEqual({ result: 'invalidated' });
    });

    test('ignores other labels and label creation', async () => {
      expect((await send('label', { action: 'edited', installation: { id: 42 }, repository, label: otherLabel })).body)
        .toEqual({ result: 'ignored' });
      expect((await send('label', { action: 'created', installation: { id: 42 }, repository, label: roadmapLabel })).body)
        .toEqual({ result: 'ignored' });
    });
  });

  describe('marketplace_purchase', () => {
    const account = { type: 'Organization', id: 77, login: 'owner' };
    const PAID_PLAN = { id: 9001, name: 'Paid' };
    const purchase = (action, plan, effectiveDate, extra = {}) => ({
      action,
      effective_date: effectiveDate,
      sender: { login: 'billing-admin' },
      marketplace_purchase: { account, billing_cycle: 'monthly', on_free_trial: false, plan, ...extra },
    });
    // Installation 42 covers owner/repo; its account is linked to the plan
    const linkInstallation = (id = 42, repos = ['owner/repo'], tier = 'free') => {
      mockStore.set(`installation:${id}`, { account: 'owner', accountId: '77', repos: JSON.stringify(repos), tier });
      mockStore.set('account-installations:77', { ...(mockStore.get('account-installations:77') || {}), [id]: '1' });
    };
    const verified = (fullName) => {
      mockStore.set(`repo:${fullName}`, { tier: 'free', source: 'app', verifiedAt: '1' });
      mockStore.set(`repo-ttl:${fullName}`, '1');
    };
    const { getInstallationTier } = require('../lib/github-app');

    beforeEach(() => {
      process.env.GITHUB_MARKETPLACE_PLANS = '{"9001":"paid"}';
    });

    test('rejects an unsigned or wrongly signed purchase', async () => {
      const payload = purchase('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00');
      expect((await send('marketplace_purchase', payload, { signature: '' })).statusCode).toBe(401);
      expect((await send('marketplace_purchase', payload, { signature: sign(JSON.stringify(payload), 'other') })).statusCode).toBe(401);
      expect(mockStore.has('marketplace:77')).toBe(false);
    });

    test('purchased makes the installation paid and re-verifies its repos', async () => {
      linkInstallation();
      verified('owner/repo');

      const res = await send('marketplace_purchase', purchase('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00'));

      expect(res.body).toEqual({ result: 'updated' });
      expect(await getInstallationTier(42)).toBe('paid');
      expect(mockStore.has('repo:owner/repo')).toBe(false);
      expect(mockStore.has('repo-ttl:owner/repo')).toBe(false);
    });

    test('a free trial is paid, and cancelling it drops to free', async () => {
      linkInstallation();
      await send('marketplace_purchase', purchase('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00', { on_free_trial: true }));
      expect(await getInstallationTier(42)).toBe('paid');

      verified('owner/repo');
      await send('marketplace_purchase', purchase('cancelled', PAID_PLAN, '2026-11-05T00:00:00+00:00', { on_free_trial: true }));
      expect(await getInstallationTier(42)).toBe('free');
      expect(mockStore.has('repo:owner/repo')).toBe(false);
    });

    test('changed applies the new plan', async () => {
      linkInstallation();
      await send('marketplace_purchase', purchase('purchased', { id: 9000, name: 'Free' }, '2026-11-01T00:00:00+00:00'));
      expect(await getInstallationTier(42)).toBe('free');
      await send('marketplace_purchase', purchase('changed', PAID_PLAN, '2026-11-02T00:00:00+00:00'));
      expect(await getInstallationTier(42)).toBe('paid');
    });

    test('a pending change or cancellation keeps paid until the billing cycle ends', async () => {
      linkInstallation();
      await send('marketplace_purchase', purchase('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00'));
      verified('owner/repo');

      const pending = await send('marketplace_purchase', purchase('pending_change', { id: 9000, name: 'Free' }, '2026-12-01T00:00:00+00:00'));
      expect(pending.body).toEqual({ result: 'updated' });
      expect(await getInstallationTier(42)).toBe('paid');
      // Nothing changed yet, so the cached verification stands
      expect(mockStore.has('repo:owner/repo')).toBe(true);

      await send('marketplace_purchase', purchase('pending_change_cancelled', PAID_PLAN, '2026-12-01T00:00:00+00:00'));
      expect(await getInstallationTier(42)).toBe('paid');

      await send('marketplace_purchase', purchase('cancelled', PAID_PLAN, '2026-12-01T00:00:00+00:00'));
      expect(await getInstallationTier(42)).toBe('free');
    });

    test('an out-of-order purchase cannot re-grant a cancelled plan', async () => {
      linkInstallation();
      await send('marketplace_purchase', purchase('cancelled', PAID_PLAN, '2026-12-01T00:00:00+00:00'));
      await send('marketplace_purchase', purchase('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00'));
      expect(await getInstallationTier(42)).toBe('free');
    });

    test('an unknown plan is free', async () => {
      linkInstallation();
      const res = await send('marketplace_purchase', purchase('purchased', { id: 1234, name: 'Enterprise' }, '2026-11-01T00:00:00+00:00'));
      expect(res.body).toEqual({ result: 'updated' });
      expect(await getInstallationTier(42)).toBe('free');
    });

    test('applies to every installation of the account', async () => {
      linkInstallation(42, ['owner/repo']);
      linkInstallation(43, ['owner/other']);
      verified('owner/repo');
      verified('owner/other');

      await send('marketplace_purchase', purchase('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00'));

      expect(await getInstallationTier(42)).toBe('paid');
      expect(await getInstallationTier(43)).toBe('paid');
      expect(mockStore.has('repo:owner/repo')).toBe(false);
      expect(mockStore.has('repo:owner/other')).toBe(false);
    });

    test('a purchase before the install applies once the install is seen', async () => {
      await send('marketplace_purchase', purchase('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00'));
      await send('installation', {
        action: 'created',
        installation: { id: 42, account: { login: 'owner', id: 77 } },
        repositories: [repository],
      });
      expect(await getInstallationTier(42)).toBe('paid');
    });

    test('a manual paid tier survives a Marketplace cancellation', async () => {
      linkInstallation(42, ['owner/repo'], 'paid');
      await send('marketplace_purchase', purchase('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00'));
      await send('marketplace_purchase', purchase('cancelled', PAID_PLAN, '2026-12-01T00:00:00+00:00'));
      expect(await getInstallationTier(42)).toBe('paid');
    });

    test('a manual free tier does not cancel a Marketplace plan', async () => {
      linkInstallation(42, ['owner/repo'], 'free');
      await send('marketplace_purchase', purchase('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00'));
      expect(await getInstallationTier(42)).toBe('paid');
    });

    test('a Marketplace-paid installation is webhook-driven for issue events', async () => {
      linkInstallation();
      await send('marketplace_purchase', purchase('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00'));
      cacheIssues();
      const res = await send('issues', issuePayload('labeled', [roadmapLabel], { label: roadmapLabel }));
      expect(res.body).toEqual({ result: 'invalidated' });
    });

    test('ignores a payload without a purchase', async () => {
      const res = await send('marketplace_purchase', { action: 'purchased' });
      expect(res.body).toEqual({ result: 'ignored' });
    });
  });
});
