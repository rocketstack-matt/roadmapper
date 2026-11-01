// Billing changes seen by the next roadmap request, through the real roadmap
// handler, middleware, verification, installation tier and webhook, with an
// in-memory Redis (Lua scripts run for real) and GitHub mocked.
const crypto = require('crypto');
const { Readable } = require('stream');

const mockStore = new Map();
// Called with a key before each hgetall returns, so a test can deliver a
// webhook while a request is part-way through reading its tier.
let mockBeforeHgetall = null;
jest.mock('../lib/redis', () => ({
  get: jest.fn(async (key) => (mockStore.has(key) ? mockStore.get(key) : null)),
  set: jest.fn(async (key, value) => { mockStore.set(key, value); return 'OK'; }),
  del: jest.fn(async (key) => (mockStore.delete(key) ? 1 : 0)),
  hgetall: jest.fn(async (key) => {
    const value = mockStore.has(key) ? { ...mockStore.get(key) } : null;
    if (mockBeforeHgetall) await mockBeforeHgetall(key);
    return value;
  }),
  hset: jest.fn(async (key, fields) => { mockStore.set(key, { ...(mockStore.get(key) || {}), ...fields }); return 1; }),
  eval: jest.fn(async (script, keys, args) => require('./redis-lua').evalLua(mockStore, script, keys, args)),
}));

jest.mock('../lib/ratelimit', () => ({
  checkRepoRateLimit: jest.fn(async () => ({ success: true, limit: 1, remaining: 1, reset: 0 })),
  checkIpRateLimit: jest.fn(async () => ({ success: true, limit: 1, remaining: 1, reset: 0 })),
}));

jest.mock('../roadmap', () => ({
  ...jest.requireActual('../roadmap'),
  fetchIssues: jest.fn(async () => []),
  generateRoadmapSVG: jest.fn(() => '<svg></svg>'),
}));

jest.mock('axios');

const axios = require('axios');
const { generateRoadmapSVG } = require('../roadmap');
const { checkRepoRateLimit } = require('../lib/ratelimit');
const { clearTokenCache } = require('../lib/github-app');
const { createMockReq, createMockRes } = require('./helpers');

const SECRET = 'webhook-secret';
const ACCOUNT = { type: 'Organization', id: 77, login: 'owner' };
const PAID_PLAN = { id: 9001, name: 'Paid' };
const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const originalEnv = process.env;
const roadmapHandler = require('../api/roadmap');
const webhookHandler = require('../api/webhook');
// Whether GitHub answers GET /app/installations/42
let accountLookupFails;

// The tier the roadmap request was served with
const requestTier = async () => {
  checkRepoRateLimit.mockClear();
  generateRoadmapSVG.mockClear();
  const res = createMockRes();
  await roadmapHandler(createMockReq('/owner/repo/ffffff/24292f'), res);
  expect(res.statusCode).toBe(200);
  const tier = checkRepoRateLimit.mock.calls[0][2];
  // The rendered roadmap agrees: paid repos have no cache notice
  expect(generateRoadmapSVG.mock.calls[0][3]).toEqual({ showCacheNotice: tier !== 'paid' });
  return tier;
};

const deliver = async (action, plan, effectiveDate) => {
  const body = JSON.stringify({
    action,
    effective_date: effectiveDate,
    marketplace_purchase: { account: ACCOUNT, billing_cycle: 'monthly', on_free_trial: false, plan },
  });
  const req = Readable.from([Buffer.from(body)]);
  req.method = 'POST';
  req.url = '/api/webhook';
  req.headers = {
    'x-github-event': 'marketplace_purchase',
    'x-hub-signature-256': `sha256=${crypto.createHmac('sha256', SECRET).update(body).digest('hex')}`,
  };
  const res = { statusCode: 200, status(code) { res.statusCode = code; return res; }, json(b) { res.body = b; return res; } };
  await webhookHandler(req, res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  mockBeforeHgetall = null;
  accountLookupFails = false;
  clearTokenCache();
  process.env = {
    ...originalEnv,
    UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 'test-token',
    GITHUB_APP_ID: '12345',
    GITHUB_APP_PRIVATE_KEY: privateKey,
    GITHUB_APP_WEBHOOK_SECRET: SECRET,
    GITHUB_MARKETPLACE_PLANS: '{"9001":"paid"}',
    VERCEL_ENV: 'production',
  };
  jest.spyOn(console, 'error').mockImplementation(() => {});

  // owner/repo is a public repo in installation 42 of account 77
  mockStore.set('install:owner/repo', '42');
  mockStore.set('installation:42', { account: 'owner', accountId: '77', repos: '["owner/repo"]', tier: 'free' });
  mockStore.set('account-installations:77', { 42: '1' });

  axios.get.mockImplementation(async (url) => {
    if (url.endsWith('/app/installations/42')) {
      if (accountLookupFails) throw Object.assign(new Error('GitHub is down'), { response: { status: 502 } });
      return { data: { id: 42, account: ACCOUNT } };
    }
    if (url.endsWith('/orgs/owner/installation')) return { data: { id: 42, account: ACCOUNT } };
    if (url.endsWith('/repos/owner/repo')) return { data: { private: false } };
    throw Object.assign(new Error(`unexpected ${url}`), { response: { status: 404 } });
  });
  axios.post.mockResolvedValue({ data: { token: 'ghs_installation', expires_at: new Date(Date.now() + 3600 * 1000).toISOString() } });
});

afterEach(() => {
  console.error.mockRestore();
});

afterAll(() => {
  process.env = originalEnv;
});

describe('billing changes on the next roadmap request', () => {
  test('a purchase landing while a request computes its tier is served on the next request', async () => {
    // The first request reads the account's (free) plan, then the purchase
    // is delivered and applied before that request finishes.
    mockBeforeHgetall = async (key) => {
      if (key !== 'marketplace:77') return;
      mockBeforeHgetall = null;
      expect((await deliver('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00')).body).toEqual({ result: 'updated' });
    };

    expect(await requestTier()).toBe('free');
    expect(mockStore.has('repo:owner/repo')).toBe(false);
    expect(await requestTier()).toBe('paid');
  });

  test('a cancellation landing while a request computes its tier is served on the next request', async () => {
    await deliver('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00');
    expect(await requestTier()).toBe('paid');

    mockBeforeHgetall = async (key) => {
      if (key !== 'marketplace:77') return;
      mockBeforeHgetall = null;
      await deliver('cancelled', PAID_PLAN, '2026-12-01T00:00:00+00:00');
    };

    expect(await requestTier()).toBe('paid');
    expect(await requestTier()).toBe('free');
  });

  test('a free tier served while the account link fails is not kept: the next request links and serves paid', async () => {
    await deliver('purchased', PAID_PLAN, '2026-11-01T00:00:00+00:00');
    // Installation 42's link to its account was lost
    mockStore.set('installation:42', { account: 'owner', repos: '["owner/repo"]', tier: 'free' });
    accountLookupFails = true;

    expect(await requestTier()).toBe('free');
    expect(await requestTier()).toBe('free'); // retried, still failing
    expect(axios.get.mock.calls.filter(([url]) => url.endsWith('/app/installations/42'))).toHaveLength(2);

    accountLookupFails = false;
    expect(await requestTier()).toBe('paid');
    expect(mockStore.get('installation:42').accountId).toBe('77');
  });
});
