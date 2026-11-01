const crypto = require('crypto');

// In-memory Redis so cached ids and tokens carry across calls within a test
const mockStore = new Map();
jest.mock('../../lib/redis', () => ({
  get: jest.fn(async (key) => (mockStore.has(key) ? mockStore.get(key) : null)),
  set: jest.fn(async (key, value) => { mockStore.set(key, value); return 'OK'; }),
  del: jest.fn(async (key) => (mockStore.delete(key) ? 1 : 0)),
  hgetall: jest.fn(async (key) => (mockStore.has(key) ? { ...mockStore.get(key) } : null)),
  hset: jest.fn(async (key, fields) => { mockStore.set(key, { ...(mockStore.get(key) || {}), ...fields }); return 1; }),
}));

jest.mock('axios');

const axios = require('axios');
const redis = require('../../lib/redis');
const {
  isAppConfigured,
  createAppJwt,
  getInstallationId,
  getInstallationToken,
  getInstallationTier,
  getGitHubHeaders,
} = require('../../lib/github-app');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const notFound = () => Object.assign(new Error('Not Found'), { response: { status: 404 } });
const inAnHour = () => new Date(Date.now() + 3600 * 1000).toISOString();

const mockInstalled = (id = 42, login = 'owner') => {
  axios.get.mockResolvedValue({ data: { id, account: { login } } });
  axios.post.mockResolvedValue({ data: { token: 'ghs_installation', expires_at: inAnHour() } });
};

const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  process.env = { ...originalEnv, GITHUB_APP_ID: '12345', GITHUB_APP_PRIVATE_KEY: privateKey };
  delete process.env.GITHUB_TOKEN;
});

afterAll(() => {
  process.env = originalEnv;
});

describe('lib/github-app', () => {
  describe('isAppConfigured', () => {
    test('true when App id and private key are set', () => {
      expect(isAppConfigured()).toBe(true);
    });

    test('false when either is missing', () => {
      delete process.env.GITHUB_APP_PRIVATE_KEY;
      expect(isAppConfigured()).toBe(false);
      process.env.GITHUB_APP_PRIVATE_KEY = privateKey;
      delete process.env.GITHUB_APP_ID;
      expect(isAppConfigured()).toBe(false);
    });
  });

  describe('createAppJwt', () => {
    const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString());

    test('signs an RS256 JWT verifiable with the App public key', () => {
      const [header, payload, signature] = createAppJwt().split('.');
      const valid = crypto.verify(
        'RSA-SHA256',
        Buffer.from(`${header}.${payload}`),
        publicKey,
        Buffer.from(signature, 'base64url')
      );
      expect(valid).toBe(true);
      expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
    });

    test('issues for the App id, backdated 60s and expiring within 10 minutes', () => {
      const now = Date.UTC(2026, 10, 1);
      const payload = decode(createAppJwt(now).split('.')[1]);
      expect(payload).toEqual({ iss: '12345', iat: now / 1000 - 60, exp: now / 1000 + 540 });
    });

    test('accepts a private key with escaped newlines', () => {
      process.env.GITHUB_APP_PRIVATE_KEY = privateKey.replace(/\n/g, '\\n');
      expect(() => createAppJwt()).not.toThrow();
    });
  });

  describe('getInstallationId', () => {
    test('returns null without calling GitHub when the App is not configured', async () => {
      delete process.env.GITHUB_APP_ID;
      expect(await getInstallationId('owner', 'repo')).toBeNull();
      expect(axios.get).not.toHaveBeenCalled();
      expect(redis.get).not.toHaveBeenCalled();
    });

    test('looks up the installation with an App JWT and caches it', async () => {
      mockInstalled(42, 'owner');

      expect(await getInstallationId('owner', 'repo')).toBe('42');
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/installation',
        { headers: expect.objectContaining({ Authorization: expect.stringMatching(/^Bearer .+\..+\..+$/) }) }
      );
      expect(redis.set).toHaveBeenCalledWith('install:owner/repo', '42', { ex: 86400 });
      expect(mockStore.get('installation:42')).toEqual({
        account: 'owner',
        repos: JSON.stringify(['owner/repo']),
        tier: 'free',
      });
    });

    test('uses the cached installation id', async () => {
      mockStore.set('install:owner/repo', 42); // Upstash may deserialize to a number
      expect(await getInstallationId('owner', 'repo')).toBe('42');
      expect(axios.get).not.toHaveBeenCalled();
    });

    test('caches a not-installed marker on 404', async () => {
      axios.get.mockRejectedValue(notFound());

      expect(await getInstallationId('owner', 'repo')).toBeNull();
      expect(redis.set).toHaveBeenCalledWith('install:owner/repo', 'none', { ex: 600 });

      expect(await getInstallationId('owner', 'repo')).toBeNull();
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    test('does not cache other failures', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      axios.get.mockRejectedValue(Object.assign(new Error('Unauthorized'), { response: { status: 401 } }));

      expect(await getInstallationId('owner', 'repo')).toBeNull();
      expect(mockStore.has('install:owner/repo')).toBe(false);
      console.error.mockRestore();
    });

    test('adds repos to the installation record and keeps its tier', async () => {
      mockStore.set('installation:42', { account: 'owner', repos: ['owner/one'], tier: 'paid' });
      mockInstalled(42, 'owner');

      await getInstallationId('owner', 'two');

      expect(mockStore.get('installation:42')).toEqual({
        account: 'owner',
        repos: JSON.stringify(['owner/one', 'owner/two']),
        tier: 'paid',
      });
    });
  });

  describe('getInstallationToken', () => {
    test('exchanges the App JWT for a token and caches it until shortly before expiry', async () => {
      mockInstalled();

      expect(await getInstallationToken('42')).toBe('ghs_installation');
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.github.com/app/installations/42/access_tokens',
        {},
        { headers: expect.objectContaining({ Authorization: expect.stringMatching(/^Bearer /) }) }
      );
      const [key, value, { ex }] = redis.set.mock.calls[0];
      expect(key).toBe('install-token:42');
      expect(value).toBe('ghs_installation');
      expect(ex).toBeGreaterThan(3300 - 5);
      expect(ex).toBeLessThanOrEqual(3300);
    });

    test('returns the cached token without calling GitHub', async () => {
      mockStore.set('install-token:42', 'ghs_cached');
      expect(await getInstallationToken('42')).toBe('ghs_cached');
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('does not cache a token that is about to expire', async () => {
      axios.post.mockResolvedValue({ data: { token: 'ghs_short', expires_at: new Date(Date.now() + 60 * 1000).toISOString() } });
      expect(await getInstallationToken('42')).toBe('ghs_short');
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe('getInstallationTier', () => {
    test('returns the installation tier, defaulting to free', async () => {
      expect(await getInstallationTier('42')).toBe('free');
      mockStore.set('installation:42', { tier: 'paid' });
      expect(await getInstallationTier('42')).toBe('paid');
    });
  });

  describe('getGitHubHeaders', () => {
    test('uses the installation token when the App is installed', async () => {
      process.env.GITHUB_TOKEN = 'shared-token';
      mockInstalled();

      expect(await getGitHubHeaders('owner', 'repo')).toEqual({ Authorization: 'Bearer ghs_installation' });
    });

    test('falls back to GITHUB_TOKEN when the App is not installed', async () => {
      process.env.GITHUB_TOKEN = 'shared-token';
      axios.get.mockRejectedValue(notFound());

      expect(await getGitHubHeaders('owner', 'repo')).toEqual({ Authorization: 'Bearer shared-token' });
    });

    test('falls back to GITHUB_TOKEN and forgets a removed installation', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      process.env.GITHUB_TOKEN = 'shared-token';
      mockStore.set('install:owner/repo', '42');
      axios.post.mockRejectedValue(notFound());

      expect(await getGitHubHeaders('owner', 'repo')).toEqual({ Authorization: 'Bearer shared-token' });
      expect(mockStore.has('install:owner/repo')).toBe(false);
      console.error.mockRestore();
    });

    test('behaves as before when the App is not configured', async () => {
      delete process.env.GITHUB_APP_ID;
      delete process.env.GITHUB_APP_PRIVATE_KEY;

      expect(await getGitHubHeaders('owner', 'repo')).toEqual({});
      process.env.GITHUB_TOKEN = 'shared-token';
      expect(await getGitHubHeaders('owner', 'repo')).toEqual({ Authorization: 'Bearer shared-token' });
      expect(axios.get).not.toHaveBeenCalled();
      expect(axios.post).not.toHaveBeenCalled();
      expect(redis.get).not.toHaveBeenCalled();
    });
  });
});
