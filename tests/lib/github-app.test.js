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
  clearTokenCache,
  PrivateRepoError,
  AppAuthError,
} = require('../../lib/github-app');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const notFound = () => Object.assign(new Error('Not Found'), { response: { status: 404 } });
const inAnHour = () => new Date(Date.now() + 3600 * 1000).toISOString();

// GET /repos/{owner}/{repo}/installation answers with the installation;
// GET /repos/{owner}/{repo} with the repo's visibility.
const mockInstalled = (id = 42, login = 'owner', { private: isPrivate = false } = {}) => {
  axios.get.mockImplementation(async (url) => (url.endsWith('/installation')
    ? { data: { id, account: { login } } }
    : { data: { private: isPrivate } }));
  axios.post.mockResolvedValue({ data: { token: 'ghs_installation', expires_at: inAnHour() } });
};

const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  clearTokenCache();
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

    test('false when the App id is only whitespace', () => {
      process.env.GITHUB_APP_ID = '  \n';
      expect(isAppConfigured()).toBe(false);
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
    test('mints a read-only token scoped to the repo', async () => {
      mockInstalled();

      expect(await getInstallationToken('42', 'owner', 'repo')).toBe('ghs_installation');
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.github.com/app/installations/42/access_tokens',
        { repositories: ['repo'], permissions: { issues: 'read', contents: 'read', metadata: 'read' } },
        { headers: expect.objectContaining({ Authorization: expect.stringMatching(/^Bearer /) }) }
      );
    });

    test('keeps the token in memory, never in Redis', async () => {
      mockInstalled();

      await getInstallationToken('42', 'owner', 'repo');
      expect(await getInstallationToken('42', 'Owner', 'Repo')).toBe('ghs_installation');

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(redis.set).not.toHaveBeenCalled();
      expect(JSON.stringify([...mockStore.values()])).not.toContain('ghs_installation');
    });

    test('mints a separate token per repo', async () => {
      mockInstalled();

      await getInstallationToken('42', 'owner', 'one');
      await getInstallationToken('42', 'owner', 'two');

      expect(axios.post).toHaveBeenCalledTimes(2);
    });

    test('mints a new token once the held one is near expiry', async () => {
      axios.post.mockResolvedValue({ data: { token: 'ghs_short', expires_at: new Date(Date.now() + 60 * 1000).toISOString() } });

      await getInstallationToken('42', 'owner', 'repo');
      await getInstallationToken('42', 'owner', 'repo');

      expect(axios.post).toHaveBeenCalledTimes(2);
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
    test('uses the installation token for a public repo in an installation', async () => {
      process.env.GITHUB_TOKEN = 'shared-token';
      mockInstalled();

      expect(await getGitHubHeaders('owner', 'repo')).toEqual({ Authorization: 'Bearer ghs_installation' });
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo',
        { headers: { Authorization: 'Bearer ghs_installation' } }
      );
      expect(redis.set).toHaveBeenCalledWith('visibility:owner/repo', 'public', { ex: 60 });
    });

    test('refuses a private repo in an installation', async () => {
      process.env.GITHUB_TOKEN = 'shared-token';
      mockInstalled(42, 'owner', { private: true });

      await expect(getGitHubHeaders('owner', 'secret')).rejects.toBeInstanceOf(PrivateRepoError);
      expect(mockStore.get('visibility:owner/secret')).toBe('private');
    });

    test('treats a repo without an explicit private: false as private', async () => {
      mockInstalled();
      axios.get.mockImplementation(async (url) => (url.endsWith('/installation')
        ? { data: { id: 42, account: { login: 'owner' } } }
        : { data: {} }));

      await expect(getGitHubHeaders('owner', 'repo')).rejects.toBeInstanceOf(PrivateRepoError);
    });

    test('re-checks visibility once the cached visibility expires', async () => {
      mockInstalled();
      expect(await getGitHubHeaders('owner', 'repo')).toEqual({ Authorization: 'Bearer ghs_installation' });

      // The repo is made private; the cached 'public' expires after 60s.
      mockInstalled(42, 'owner', { private: true });
      mockStore.delete('visibility:owner/repo');

      await expect(getGitHubHeaders('owner', 'repo')).rejects.toBeInstanceOf(PrivateRepoError);
    });

    test('falls back to GITHUB_TOKEN when the App is not installed', async () => {
      process.env.GITHUB_TOKEN = 'shared-token';
      axios.get.mockRejectedValue(notFound());

      expect(await getGitHubHeaders('owner', 'repo')).toEqual({ Authorization: 'Bearer shared-token' });
    });

    test('never falls back to GITHUB_TOKEN when the token request fails, and forgets the installation', async () => {
      process.env.GITHUB_TOKEN = 'shared-token';
      mockStore.set('install:owner/repo', '42');
      axios.post.mockRejectedValue(notFound());

      await expect(getGitHubHeaders('owner', 'repo')).rejects.toBeInstanceOf(AppAuthError);
      expect(mockStore.has('install:owner/repo')).toBe(false);
    });

    test('never falls back to GITHUB_TOKEN when the visibility check fails', async () => {
      process.env.GITHUB_TOKEN = 'shared-token';
      mockInstalled();
      axios.get.mockImplementation(async (url) => {
        if (url.endsWith('/installation')) return { data: { id: 42, account: { login: 'owner' } } };
        throw Object.assign(new Error('Server Error'), { response: { status: 500 } });
      });

      await expect(getGitHubHeaders('owner', 'repo')).rejects.toBeInstanceOf(AppAuthError);
      expect(mockStore.has('install:owner/repo')).toBe(false);
    });

    test('does not put the token in the error it throws', async () => {
      mockInstalled();
      axios.get.mockImplementation(async (url) => {
        if (url.endsWith('/installation')) return { data: { id: 42, account: { login: 'owner' } } };
        throw new Error('Request failed with status code 500');
      });

      const error = await getGitHubHeaders('owner', 'repo').catch((e) => e);
      expect(error.message).not.toContain('ghs_installation');
    });

    test('case-folds owner and repo in Redis keys', async () => {
      mockInstalled();

      await getGitHubHeaders('Owner', 'Repo');

      expect(mockStore.get('install:owner/repo')).toBe('42');
      expect(mockStore.get('visibility:owner/repo')).toBe('public');
    });

    test('does not mint a token per request without Redis', async () => {
      // The no-op Redis client caches nothing
      redis.get.mockResolvedValue(null);
      redis.set.mockResolvedValue('OK');
      mockInstalled();

      await getGitHubHeaders('owner', 'repo');
      await getGitHubHeaders('owner', 'repo');

      expect(axios.post).toHaveBeenCalledTimes(1);
      redis.get.mockImplementation(async (key) => (mockStore.has(key) ? mockStore.get(key) : null));
      redis.set.mockImplementation(async (key, value) => { mockStore.set(key, value); return 'OK'; });
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
