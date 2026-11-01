jest.mock('../../lib/redis', () => ({
  hgetall: jest.fn(() => Promise.resolve(null)),
  hset: jest.fn(() => Promise.resolve(0)),
  get: jest.fn(() => Promise.resolve(null)),
  set: jest.fn(() => Promise.resolve('OK')),
  del: jest.fn(() => Promise.resolve(1)),
}));

jest.mock('axios');

const redis = require('../../lib/redis');
const axios = require('axios');
const { verifyRepo, fetchRoadmapperFile, getCachedVerification, isVerificationStale } = require('../../lib/verify');
const { hashApiKey } = require('../../lib/keys');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('lib/verify', () => {
  const validKey = 'rm_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
  const keyHash = hashApiKey(validKey);

  describe('getCachedVerification', () => {
    test('returns cached data when present', async () => {
      redis.hgetall.mockResolvedValue({ tier: 'free', verifiedAt: '2026-01-01T00:00:00Z' });
      const result = await getCachedVerification('owner', 'repo');
      expect(result).toEqual({ tier: 'free', verifiedAt: '2026-01-01T00:00:00Z' });
    });

    test('returns null when no cache', async () => {
      redis.hgetall.mockResolvedValue(null);
      const result = await getCachedVerification('owner', 'repo');
      expect(result).toBeNull();
    });

    test('returns null when cache has no tier', async () => {
      redis.hgetall.mockResolvedValue({});
      const result = await getCachedVerification('owner', 'repo');
      expect(result).toBeNull();
    });
  });

  describe('isVerificationStale', () => {
    test('returns false when TTL marker exists', async () => {
      redis.get.mockResolvedValue('1');
      const result = await isVerificationStale('owner', 'repo');
      expect(result).toBe(false);
    });

    test('returns true when TTL marker expired', async () => {
      redis.get.mockResolvedValue(null);
      const result = await isVerificationStale('owner', 'repo');
      expect(result).toBe(true);
    });
  });

  describe('fetchRoadmapperFile', () => {
    test('returns decoded file content', async () => {
      const base64Content = Buffer.from(validKey).toString('base64');
      axios.get.mockResolvedValue({ data: { content: base64Content } });

      const result = await fetchRoadmapperFile('owner', 'repo');
      expect(result).toBe(validKey);
    });

    test('returns null when file not found', async () => {
      axios.get.mockRejectedValue({ response: { status: 404 } });
      const result = await fetchRoadmapperFile('owner', 'repo');
      expect(result).toBeNull();
    });

    test('returns null when response has no content', async () => {
      axios.get.mockResolvedValue({ data: {} });
      const result = await fetchRoadmapperFile('owner', 'repo');
      expect(result).toBeNull();
    });

    test('trims whitespace from content', async () => {
      const base64Content = Buffer.from(`  ${validKey}  \n`).toString('base64');
      axios.get.mockResolvedValue({ data: { content: base64Content } });

      const result = await fetchRoadmapperFile('owner', 'repo');
      expect(result).toBe(validKey);
    });
  });

  describe('verifyRepo', () => {
    test('returns cached verification when fresh', async () => {
      // Return cached verification
      redis.hgetall.mockResolvedValueOnce({ tier: 'free', verifiedAt: '2026-01-01T00:00:00Z' });
      // TTL marker still exists (not stale)
      redis.get.mockResolvedValueOnce('1');

      const result = await verifyRepo('owner', 'repo');
      expect(result).toEqual({ verified: true, tier: 'free' });
      // Should not have fetched from GitHub
      expect(axios.get).not.toHaveBeenCalled();
    });

    test('re-verifies when cache is stale', async () => {
      // Return cached verification
      redis.hgetall.mockResolvedValueOnce({ tier: 'free', verifiedAt: '2026-01-01T00:00:00Z' });
      // TTL marker expired (stale)
      redis.get.mockResolvedValueOnce(null);
      // Fetch .roadmapper file
      const base64Content = Buffer.from(validKey).toString('base64');
      axios.get.mockResolvedValueOnce({ data: { content: base64Content } });
      // Look up key in Redis
      redis.hgetall.mockResolvedValueOnce({ owner: 'owner', repo: 'repo', tier: 'free' });

      const result = await verifyRepo('owner', 'repo');
      expect(result).toEqual({ verified: true, tier: 'free' });
    });

    test('returns not verified when no .roadmapper file', async () => {
      redis.hgetall.mockResolvedValue(null);
      axios.get.mockRejectedValue({ response: { status: 404 } });

      const result = await verifyRepo('owner', 'repo');
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('No .roadmapper file');
    });

    test('returns not verified for invalid key format', async () => {
      redis.hgetall.mockResolvedValue(null);
      const base64Content = Buffer.from('invalid-key').toString('base64');
      axios.get.mockResolvedValue({ data: { content: base64Content } });

      const result = await verifyRepo('owner', 'repo');
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('Invalid key format');
    });

    test('returns not verified for unregistered key', async () => {
      redis.hgetall.mockResolvedValueOnce(null); // No cached verification
      const base64Content = Buffer.from(validKey).toString('base64');
      axios.get.mockResolvedValue({ data: { content: base64Content } });
      redis.hgetall.mockResolvedValueOnce(null); // Key not found in Redis

      const result = await verifyRepo('owner', 'repo');
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('Unregistered');
    });

    test('returns not verified when key does not match repo', async () => {
      redis.hgetall.mockResolvedValueOnce(null); // No cached verification
      const base64Content = Buffer.from(validKey).toString('base64');
      axios.get.mockResolvedValue({ data: { content: base64Content } });
      redis.hgetall.mockResolvedValueOnce({ owner: 'other-owner', repo: 'other-repo', tier: 'free' });

      const result = await verifyRepo('owner', 'repo');
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('does not match');
    });

    test('caches verification on success', async () => {
      redis.hgetall.mockResolvedValueOnce(null); // No cached verification
      const base64Content = Buffer.from(validKey).toString('base64');
      axios.get.mockResolvedValue({ data: { content: base64Content } });
      redis.hgetall.mockResolvedValueOnce({ owner: 'owner', repo: 'repo', tier: 'free' });

      await verifyRepo('owner', 'repo');

      // Check that verification was cached
      expect(redis.hset).toHaveBeenCalledWith(
        'repo:owner/repo',
        expect.objectContaining({ tier: 'free' })
      );
    });

    test('returns not verified when email not confirmed', async () => {
      redis.hgetall.mockResolvedValueOnce(null); // No cached verification
      const base64Content = Buffer.from(validKey).toString('base64');
      axios.get.mockResolvedValue({ data: { content: base64Content } });
      redis.hgetall.mockResolvedValueOnce({ owner: 'owner', repo: 'repo', tier: 'free', emailConfirmed: 'false' });

      const result = await verifyRepo('owner', 'repo');
      expect(result.verified).toBe(false);
      expect(result.reason).toContain('Email not yet confirmed');
    });

    test('passes verification when email confirmed', async () => {
      redis.hgetall.mockResolvedValueOnce(null); // No cached verification
      const base64Content = Buffer.from(validKey).toString('base64');
      axios.get.mockResolvedValue({ data: { content: base64Content } });
      redis.hgetall.mockResolvedValueOnce({ owner: 'owner', repo: 'repo', tier: 'free', emailConfirmed: 'true' });

      const result = await verifyRepo('owner', 'repo');
      expect(result.verified).toBe(true);
      expect(result.tier).toBe('free');
    });

    test('passes verification for legacy keys without emailConfirmed field', async () => {
      redis.hgetall.mockResolvedValueOnce(null); // No cached verification
      const base64Content = Buffer.from(validKey).toString('base64');
      axios.get.mockResolvedValue({ data: { content: base64Content } });
      redis.hgetall.mockResolvedValueOnce({ owner: 'owner', repo: 'repo', tier: 'free' });

      const result = await verifyRepo('owner', 'repo');
      expect(result.verified).toBe(true);
    });
  });

  describe('verifyRepo with the GitHub App installed', () => {
    const { privateKey } = require('crypto').generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const { clearTokenCache } = require('../../lib/github-app');
    const originalEnv = process.env;
    const store = new Map();
    // What GitHub currently says about owner/repo
    let github;

    beforeEach(() => {
      process.env = { ...originalEnv, GITHUB_APP_ID: '12345', GITHUB_APP_PRIVATE_KEY: privateKey, GITHUB_TOKEN: 'shared-token' };
      store.clear();
      store.set('installation:42', { account: 'owner', tier: 'paid' });
      clearTokenCache();
      github = { installed: true, private: false, roadmapperFile: null, mintFails: false };
      jest.spyOn(console, 'error').mockImplementation(() => {});

      redis.get.mockImplementation(async (key) => (store.has(key) ? store.get(key) : null));
      redis.set.mockImplementation(async (key, value) => { store.set(key, value); return 'OK'; });
      redis.del.mockImplementation(async (key) => (store.delete(key) ? 1 : 0));
      redis.hgetall.mockImplementation(async (key) => (store.has(key) ? { ...store.get(key) } : null));
      redis.hset.mockImplementation(async (key, fields) => { store.set(key, { ...(store.get(key) || {}), ...fields }); return 1; });

      axios.get.mockImplementation(async (url) => {
        if (url.endsWith('/installation')) {
          if (!github.installed) throw { response: { status: 404 } };
          return { data: { id: 42, account: { login: 'owner' } } };
        }
        if (url.endsWith('/contents/.roadmapper')) {
          if (!github.roadmapperFile) throw { response: { status: 404 } };
          return { data: { content: Buffer.from(github.roadmapperFile).toString('base64') } };
        }
        return { data: { private: github.private } };
      });
      axios.post.mockImplementation(async () => {
        if (github.mintFails) throw { response: { status: github.installed ? 500 : 404 }, message: 'mint failed' };
        return { data: { token: 'ghs_installation', expires_at: new Date(Date.now() + 3600 * 1000).toISOString() } };
      });
    });

    afterEach(() => {
      process.env = originalEnv;
      console.error.mockRestore();
      redis.get.mockImplementation(() => Promise.resolve(null));
      redis.set.mockImplementation(() => Promise.resolve('OK'));
      redis.del.mockImplementation(() => Promise.resolve(1));
      redis.hgetall.mockImplementation(() => Promise.resolve(null));
      redis.hset.mockImplementation(() => Promise.resolve(0));
      axios.post.mockReset();
    });

    test('serves a public repo in an installation with its tier, without a .roadmapper file', async () => {
      const result = await verifyRepo('owner', 'repo');

      expect(result).toEqual({ verified: true, tier: 'paid' });
      expect(axios.get).not.toHaveBeenCalledWith(expect.stringContaining('/contents/.roadmapper'), expect.anything());
      expect(store.get('repo:owner/repo')).toEqual(expect.objectContaining({ tier: 'paid', source: 'app' }));
    });

    test('refuses a private repo in an installation', async () => {
      github.private = true;
      store.set('cache:issues:owner/repo', '{"issues":[]}');

      const result = await verifyRepo('owner', 'repo');

      expect(result).toEqual({ verified: false, reason: 'Private repositories are not supported yet' });
      expect(store.has('repo:owner/repo')).toBe(false);
      expect(store.has('cache:issues:owner/repo')).toBe(false);
    });

    test('refuses a private repo in an installation even with a .roadmapper file', async () => {
      github.private = true;
      github.roadmapperFile = validKey;
      store.set(`apikey:${keyHash}`, { owner: 'owner', repo: 'repo', tier: 'free' });

      const result = await verifyRepo('owner', 'repo');

      expect(result.verified).toBe(false);
    });

    test('stops serving a repo made private, despite the cached verification', async () => {
      expect((await verifyRepo('owner', 'repo')).verified).toBe(true);
      expect(store.get('visibility:owner/repo')).toBe('public');

      // The repo is made private; the 60s visibility cache then expires.
      github.private = true;
      store.delete('visibility:owner/repo');

      const result = await verifyRepo('owner', 'repo');

      expect(result).toEqual({ verified: false, reason: 'Private repositories are not supported yet' });
      expect(store.get('repo-ttl:owner/repo')).toBe('1'); // the cached verification was not trusted
    });

    test('drops an App-only verification after an uninstall instead of using GITHUB_TOKEN', async () => {
      expect((await verifyRepo('owner', 'repo')).verified).toBe(true);

      // The App is uninstalled; the cached install mapping is still there.
      github.installed = false;
      github.mintFails = true;
      clearTokenCache();
      store.delete('visibility:owner/repo');

      const result = await verifyRepo('owner', 'repo');

      expect(result.verified).toBe(false);
      expect(result.reason).toContain('No .roadmapper file');
      expect(store.get('install:owner/repo')).toBe('none');
    });

    test('keeps serving a repo with its own .roadmapper file after an uninstall', async () => {
      github.roadmapperFile = validKey;
      store.set(`apikey:${keyHash}`, { owner: 'owner', repo: 'repo', tier: 'free' });
      expect((await verifyRepo('owner', 'repo')).verified).toBe(true);

      github.installed = false;
      github.mintFails = true;
      clearTokenCache();
      store.delete('visibility:owner/repo');

      expect(await verifyRepo('owner', 'repo')).toEqual({ verified: true, tier: 'free' });
    });

    test('refuses an installed repo when the token request fails, without falling back to GITHUB_TOKEN', async () => {
      github.mintFails = true;

      const result = await verifyRepo('owner', 'repo');

      expect(result.verified).toBe(false);
      expect(result.reason).toContain('GitHub App');
      expect(axios.get).not.toHaveBeenCalledWith(expect.anything(), { headers: { Authorization: 'Bearer shared-token' } });
      expect(store.has('install:owner/repo')).toBe(false);
    });

    test('does not downgrade a repo with a paid key', async () => {
      store.set('installation:42', { account: 'owner', tier: 'free' });
      store.set('repo-key:owner/repo', keyHash);
      store.set(`apikey:${keyHash}`, { owner: 'owner', repo: 'repo', tier: 'paid' });

      expect(await verifyRepo('owner', 'repo')).toEqual({ verified: true, tier: 'paid' });
    });

    test('keeps a paid key for a mixed-case request', async () => {
      store.set('installation:42', { account: 'owner', tier: 'free' });
      store.set('repo-key:owner/repo', keyHash);
      store.set(`apikey:${keyHash}`, { owner: 'owner', repo: 'repo', tier: 'paid' });

      expect(await verifyRepo('Owner', 'Repo')).toEqual({ verified: true, tier: 'paid' });
      expect(store.get('repo:owner/repo')).toEqual(expect.objectContaining({ tier: 'paid' }));
      expect(await verifyRepo('owner', 'repo')).toEqual({ verified: true, tier: 'paid' });
    });

    test('case-folds owner and repo in cache keys', async () => {
      await verifyRepo('Owner', 'Repo');

      expect(store.has('repo:owner/repo')).toBe(true);
      expect(store.has('install:owner/repo')).toBe(true);
    });

    test('falls back to the .roadmapper file when the App is not installed', async () => {
      github.installed = false;
      github.roadmapperFile = validKey;
      store.set(`apikey:${keyHash}`, { owner: 'owner', repo: 'repo', tier: 'free' });

      const result = await verifyRepo('owner', 'repo');

      expect(result).toEqual({ verified: true, tier: 'free' });
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/contents/.roadmapper',
        { headers: { Authorization: 'Bearer shared-token' } }
      );
    });
  });
});
