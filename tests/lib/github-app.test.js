const crypto = require('crypto');

// In-memory Redis so cached ids and tokens carry across calls within a test
const mockStore = new Map();
jest.mock('../../lib/redis', () => ({
  get: jest.fn(async (key) => (mockStore.has(key) ? mockStore.get(key) : null)),
  set: jest.fn(async (key, value) => { mockStore.set(key, value); return 'OK'; }),
  del: jest.fn(async (key) => (mockStore.delete(key) ? 1 : 0)),
  hgetall: jest.fn(async (key) => (mockStore.has(key) ? { ...mockStore.get(key) } : null)),
  hset: jest.fn(async (key, fields) => { mockStore.set(key, { ...(mockStore.get(key) || {}), ...fields }); return 1; }),
  eval: jest.fn(async (script, keys, args) => require('../redis-lua').evalLua(mockStore, script, keys, args)),
}));

jest.mock('axios');

const axios = require('axios');
const redis = require('../../lib/redis');
const {
  isAppConfigured,
  isWebhookConfigured,
  addInstallationRepos,
  removeInstallationRepos,
  deleteInstallation,
  createAppJwt,
  getInstallationId,
  getInstallationToken,
  getInstallationTier,
  setInstallationTier,
  getAccountInstallations,
  getInstallationRepos,
  getAppInstallUrl,
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

  describe('getAppInstallUrl', () => {
    test('links to the App install page from its slug', () => {
      process.env.GITHUB_APP_SLUG = ' roadmapper-app\n';
      expect(getAppInstallUrl()).toBe('https://github.com/apps/roadmapper-app/installations/new');
    });

    test('null without a slug or without App credentials', () => {
      delete process.env.GITHUB_APP_SLUG;
      expect(getAppInstallUrl()).toBeNull();
      process.env.GITHUB_APP_SLUG = 'roadmapper-app';
      delete process.env.GITHUB_APP_ID;
      expect(getAppInstallUrl()).toBeNull();
    });
  });

  describe('getInstallationTier', () => {
    test('returns the installation tier, defaulting to free', async () => {
      expect(await getInstallationTier('42')).toBe('free');
      mockStore.set('installation:42', { tier: 'paid' });
      expect(await getInstallationTier('42')).toBe('paid');
    });

    test('an unknown tier counts as free', async () => {
      mockStore.set('installation:42', { tier: 'platinum' });
      expect(await getInstallationTier('42')).toBe('free');
    });

    describe('with a GitHub Marketplace plan', () => {
      beforeEach(() => {
        process.env.GITHUB_MARKETPLACE_PLANS = '{"9001":"paid"}';
        mockStore.set('marketplace:77', { account: 'owner', planId: '9001', planName: 'Paid' });
      mockStore.set('marketplace-checked:77', 'checked');
        // Reconciled with GitHub recently, so no Marketplace lookup
        mockStore.set('marketplace-checked:77', 'checked');
      });

      test("uses the account's plan", async () => {
        mockStore.set('installation:42', { accountId: '77', tier: 'free' });
        expect(await getInstallationTier('42')).toBe('paid');
      });

      test("ignores another account's plan", async () => {
        mockStore.set('installation:42', { tier: 'free' });
        axios.get.mockResolvedValueOnce({ data: { id: 42, account: { login: 'other', id: 88 } } });
        expect(await getInstallationTier('42')).toBe('free');
        expect(mockStore.get('installation:42').accountId).toBe('88');
      });

      test('a manual paid tier wins over a free or cancelled plan', async () => {
        mockStore.set('marketplace:77', { account: 'owner', planId: '', planName: '' });
        mockStore.set('installation:42', { accountId: '77', tier: 'paid' });
        expect(await getInstallationTier('42')).toBe('paid');
      });

      test('setting the manual tier to free keeps a paid plan', async () => {
        mockStore.set('installation:42', { accountId: '77', tier: 'paid', repos: '[]' });
        await setInstallationTier('42', 'free');
        expect(await getInstallationTier('42')).toBe('paid');
      });
    });
  });

  describe('Marketplace reconciliation', () => {
    beforeEach(() => {
      process.env.GITHUB_MARKETPLACE_PLANS = '{"9001":"paid"}';
      mockStore.set('installation:42', { accountId: '77', tier: 'free' });
    });

    test("reads the account's purchase from GitHub with the App JWT when nothing is recorded", async () => {
      axios.get.mockResolvedValueOnce({ data: { id: 77, login: 'owner', marketplace_purchase: { plan: { id: 9001, name: 'Paid' }, updated_at: '2026-11-01T00:00:00Z' } } });
      expect(await getInstallationTier('42')).toBe('paid');
      const [url, { headers }] = axios.get.mock.calls[0];
      expect(url).toBe('https://api.github.com/marketplace_listing/accounts/77');
      expect(headers.Authorization).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    });

    test('a 404 is no purchase', async () => {
      axios.get.mockRejectedValueOnce(notFound());
      expect(await getInstallationTier('42')).toBe('free');
      expect(mockStore.get('marketplace-checked:77')).toBe('none');
    });

    test('reads the stubbed endpoint with GITHUB_MARKETPLACE_STUBBED', async () => {
      process.env.GITHUB_MARKETPLACE_STUBBED = 'true';
      axios.get.mockRejectedValueOnce(notFound());
      await getInstallationTier('42');
      expect(axios.get.mock.calls[0][0]).toBe('https://api.github.com/marketplace_listing/stubbed/accounts/77');
    });

    test('makes no lookup without the App', async () => {
      delete process.env.GITHUB_APP_ID;
      expect(await getInstallationTier('42')).toBe('free');
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe('account links', () => {
    test('an installation lookup links the installation to its account', async () => {
      axios.get.mockResolvedValue({ data: { id: 42, account: { login: 'owner', id: 77 } } });
      await getInstallationId('owner', 'repo');

      expect(mockStore.get('installation:42').accountId).toBe('77');
      expect(mockStore.get('account-installations:77')).toEqual({ 42: '1' });
    });

    test('addInstallationRepos links the account, once', async () => {
      const installation = { id: 42, account: { login: 'owner', id: 77 } };
      await addInstallationRepos(installation, [{ full_name: 'owner/a', private: false }]);
      await addInstallationRepos(installation, [{ full_name: 'owner/b', private: false }]);
      expect(mockStore.get('account-installations:77')).toEqual({ 42: '1' });
    });

    test('a failed link heals on the next tier read', async () => {
      const redis = require('../../lib/redis');
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      process.env.GITHUB_MARKETPLACE_PLANS = '{"9001":"paid"}';
      mockStore.set('marketplace:77', { account: 'owner', planId: '9001', planName: 'Paid' });
      mockStore.set('marketplace-checked:77', 'checked');

      // The installation is recorded, but the link's last write fails, as a
      // Redis blip would
      const write = redis.hset.getMockImplementation();
      redis.hset.mockImplementationOnce(write).mockImplementationOnce(write).mockRejectedValueOnce(new Error('redis down'));
      axios.get.mockResolvedValueOnce({ data: { id: 42, account: { login: 'owner', id: 77 } } });
      await getInstallationId('owner', 'repo');
      expect(mockStore.get('installation:42').accountId).toBeUndefined();
      axios.get.mockClear();

      // The next tier read asks GitHub for the account and links it
      axios.get.mockResolvedValueOnce({ data: { id: 42, account: { login: 'owner', id: 77 } } });
      expect(await getInstallationTier('42')).toBe('paid');
      expect(axios.get.mock.calls[0][0]).toBe('https://api.github.com/app/installations/42');
      expect(mockStore.get('installation:42').accountId).toBe('77');
      expect(mockStore.get('account-installations:77')).toEqual({ 42: '1' });

      // Linked now, so no more lookups
      expect(await getInstallationTier('42')).toBe('paid');
      expect(axios.get).toHaveBeenCalledTimes(1);
      error.mockRestore();
    });

    test('a failed account lookup during a tier read is retried on the next one', async () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      process.env.GITHUB_MARKETPLACE_PLANS = '{"9001":"paid"}';
      mockStore.set('marketplace:77', { account: 'owner', planId: '9001', planName: 'Paid' });
      mockStore.set('marketplace-checked:77', 'checked');
      mockStore.set('installation:42', { tier: 'free', repos: '[]' });

      axios.get.mockRejectedValueOnce(new Error('GitHub outage'));
      expect(await getInstallationTier('42')).toBe('free');
      expect(error).toHaveBeenCalled();

      axios.get.mockResolvedValueOnce({ data: { id: 42, account: { login: 'owner', id: 77 } } });
      expect(await getInstallationTier('42')).toBe('paid');
      error.mockRestore();
    });

    test("getAccountInstallations looks up an organization's installation and links it", async () => {
      mockStore.set('account-installations:77', { 41: '1' });
      axios.get.mockResolvedValue({ data: { id: 42 } });

      expect((await getAccountInstallations({ id: 77, login: 'acme', type: 'Organization' })).installations).toEqual(['41', '42']);
      expect(axios.get.mock.calls[0][0]).toBe('https://api.github.com/orgs/acme/installation');
      expect(mockStore.get('installation:42').accountId).toBe('77');
    });

    test("getAccountInstallations looks up a user's installation", async () => {
      axios.get.mockResolvedValue({ data: { id: 42 } });
      expect((await getAccountInstallations({ id: 77, login: 'someone', type: 'User' })).installations).toEqual(['42']);
      expect(axios.get.mock.calls[0][0]).toBe('https://api.github.com/users/someone/installation');
    });

    test('getAccountInstallations keeps the linked installations when the lookup fails', async () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockStore.set('account-installations:77', { 41: '1' });
      axios.get.mockRejectedValueOnce(notFound());
      expect((await getAccountInstallations({ id: 77, login: 'acme', type: 'Organization' })).installations).toEqual(['41']);
      expect(error).not.toHaveBeenCalled();

      axios.get.mockRejectedValueOnce(new Error('boom'));
      expect((await getAccountInstallations({ id: 77, login: 'acme', type: 'Organization' })).installations).toEqual(['41']);
      expect(error).toHaveBeenCalled();
      error.mockRestore();
    });

    test('getAccountInstallations makes no lookup without the App', async () => {
      delete process.env.GITHUB_APP_ID;
      expect((await getAccountInstallations({ id: 77, login: 'acme', type: 'Organization' })).installations).toEqual([]);
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe('setInstallationTier', () => {
    test('sets the tier and clears the verification of every repo it covers', async () => {
      mockStore.set('installation:42', { account: 'owner', repos: '["owner/a","owner/b"]', tier: 'free' });
      mockStore.set('repo:owner/a', { tier: 'free', source: 'app' });
      mockStore.set('repo-ttl:owner/a', '1');
      mockStore.set('repo:owner/b', { tier: 'free', source: 'app' });

      expect(await setInstallationTier('42', 'paid')).toEqual(['owner/a', 'owner/b']);

      expect(await getInstallationTier('42')).toBe('paid');
      expect(mockStore.get('installation:42').account).toBe('owner');
      expect(mockStore.has('repo:owner/a')).toBe(false);
      expect(mockStore.has('repo-ttl:owner/a')).toBe(false);
      expect(mockStore.has('repo:owner/b')).toBe(false);
    });

    test('records the tier for an installation not seen yet, which a later lookup keeps', async () => {
      await setInstallationTier('42', 'paid');
      mockInstalled();
      await getInstallationId('owner', 'repo');

      expect(mockStore.get('installation:42')).toEqual({ account: 'owner', repos: '["owner/repo"]', tier: 'paid' });
    });

    test('rejects an unknown tier', async () => {
      await expect(setInstallationTier('42', 'platinum')).rejects.toThrow('Invalid tier');
      expect(mockStore.has('installation:42')).toBe(false);
    });
  });

  describe('getInstallationRepos', () => {
    const repos = (count, start = 0) => Array.from({ length: count }, (_, i) => ({ full_name: `owner/r${start + i}`, private: false }));

    test('lists the account and repos, paginating, with a metadata-only token', async () => {
      axios.get.mockImplementation(async (url) => {
        if (url.endsWith('/app/installations/42')) return { data: { id: 42, account: { login: 'Owner' } } };
        if (url.endsWith('page=1')) return { data: { repositories: repos(100) } };
        return { data: { repositories: [{ full_name: 'owner/secret', private: true }, { full_name: 'owner/odd' }] } };
      });
      axios.post.mockResolvedValue({ data: { token: 'ghs_list', expires_at: inAnHour() } });

      const result = await getInstallationRepos('42');

      expect(result.account).toBe('Owner');
      expect(result.repositories).toHaveLength(102);
      expect(result.repositories[0]).toEqual({ owner: 'owner', repo: 'r0', private: false });
      // Anything without an explicit private: false counts as private
      expect(result.repositories.slice(100)).toEqual([
        { owner: 'owner', repo: 'secret', private: true },
        { owner: 'owner', repo: 'odd', private: true },
      ]);
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.github.com/app/installations/42/access_tokens',
        { permissions: { metadata: 'read' } },
        expect.anything()
      );
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.github.com/installation/repositories?per_page=100&page=2',
        { headers: expect.objectContaining({ Authorization: 'Bearer ghs_list' }) }
      );
    });

    test('null for an installation that does not exist', async () => {
      axios.get.mockRejectedValue(notFound());
      expect(await getInstallationRepos('42')).toBeNull();
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('other errors are thrown', async () => {
      axios.get.mockRejectedValue(new Error('boom'));
      await expect(getInstallationRepos('42')).rejects.toThrow('boom');
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

  describe('isWebhookConfigured', () => {
    test('true when the App and webhook secret are set', () => {
      process.env.GITHUB_APP_WEBHOOK_SECRET = 'secret';
      expect(isWebhookConfigured()).toBe(true);
    });

    test('false without the webhook secret or the App', () => {
      expect(isWebhookConfigured()).toBe(false);
      process.env.GITHUB_APP_WEBHOOK_SECRET = 'secret';
      delete process.env.GITHUB_APP_ID;
      expect(isWebhookConfigured()).toBe(false);
    });
  });

  describe('installation webhooks', () => {
    const installation = { id: 42, account: { login: 'owner' } };
    const repository = (name, isPrivate = false) => ({ full_name: `owner/${name}`, private: isPrivate });

    test('addInstallationRepos maps public repos and records them on the installation', async () => {
      mockStore.set('install:owner/a', 'none');
      await addInstallationRepos(installation, [repository('a'), repository('b')]);

      expect(mockStore.get('install:owner/a')).toBe('42');
      expect(mockStore.get('install:owner/b')).toBe('42');
      expect(redis.set).toHaveBeenCalledWith('install:owner/a', '42', { ex: 86400 });
      expect(JSON.parse(mockStore.get('installation:42').repos)).toEqual(['owner/a', 'owner/b']);
      expect(mockStore.get('installation:42').tier).toBe('free');
    });

    test('addInstallationRepos does not map private repos', async () => {
      mockStore.set('install:owner/secret', '42');
      mockStore.set('repo:owner/secret', { tier: 'paid', source: 'app' });
      await addInstallationRepos(installation, [repository('secret', true)]);

      expect(mockStore.has('install:owner/secret')).toBe(false);
      expect(mockStore.has('repo:owner/secret')).toBe(false);
      expect(mockStore.has('installation:42')).toBe(false);
    });

    test('addInstallationRepos clears cached verification so repos re-verify as installed', async () => {
      mockStore.set('repo:owner/a', { tier: 'free', source: 'key' });
      mockStore.set('repo-ttl:owner/a', '1');
      await addInstallationRepos(installation, [repository('a')]);

      expect(mockStore.has('repo:owner/a')).toBe(false);
      expect(mockStore.has('repo-ttl:owner/a')).toBe(false);
    });

    test('addInstallationRepos keeps an existing paid tier', async () => {
      mockStore.set('installation:42', { account: 'owner', repos: '[]', tier: 'paid' });
      await addInstallationRepos(installation, [repository('a')]);
      expect(mockStore.get('installation:42').tier).toBe('paid');
    });

    test('removeInstallationRepos unmaps repos and drops them from the record', async () => {
      await addInstallationRepos(installation, [repository('a'), repository('b')]);
      mockStore.set('repo:owner/a', { tier: 'free', source: 'app' });
      await removeInstallationRepos('42', ['owner/a']);

      expect(mockStore.has('install:owner/a')).toBe(false);
      expect(mockStore.has('repo:owner/a')).toBe(false);
      expect(mockStore.get('install:owner/b')).toBe('42');
      expect(JSON.parse(mockStore.get('installation:42').repos)).toEqual(['owner/b']);
    });

    test('deleteInstallation forgets every repo, its tokens and the record', async () => {
      mockInstalled();
      await addInstallationRepos(installation, [repository('a')]);
      await getInstallationToken('42', 'owner', 'a');
      await deleteInstallation('42', ['Owner/Listed']);

      expect(mockStore.has('install:owner/a')).toBe(false);
      expect(redis.del).toHaveBeenCalledWith('install:owner/listed');
      expect(mockStore.has('installation:42')).toBe(false);

      // The in-memory token is gone, so the next request mints a new one
      await getInstallationToken('42', 'owner', 'a');
      expect(axios.post).toHaveBeenCalledTimes(2);
    });

    test('forgetting a repo clears its cached visibility and verification', async () => {
      mockStore.set('install:owner/a', '42');
      mockStore.set('visibility:owner/a', 'public');
      mockStore.set('repo:owner/a', { tier: 'paid', source: 'app' });
      mockStore.set('repo-ttl:owner/a', '1');
      await removeInstallationRepos('42', ['Owner/A']);

      ['install:', 'visibility:', 'repo:', 'repo-ttl:'].forEach((prefix) => {
        expect(mockStore.has(`${prefix}owner/a`)).toBe(false);
      });
    });

    test('deleteInstallation with keepRecord keeps the tier (suspension)', async () => {
      mockStore.set('installation:42', { account: 'owner', repos: '["owner/a"]', tier: 'paid' });
      mockStore.set('install:owner/a', '42');
      await deleteInstallation('42', [], { keepRecord: true });

      expect(mockStore.has('install:owner/a')).toBe(false);
      expect(mockStore.get('installation:42')).toEqual({ account: 'owner', repos: '[]', tier: 'paid' });
    });
  });
});
