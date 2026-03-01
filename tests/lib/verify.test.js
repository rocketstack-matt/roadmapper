jest.mock('../../lib/redis', () => ({
  hgetall: jest.fn(() => Promise.resolve(null)),
  hset: jest.fn(() => Promise.resolve(0)),
  get: jest.fn(() => Promise.resolve(null)),
  set: jest.fn(() => Promise.resolve('OK')),
}));

jest.mock('axios');

jest.mock('../../lib/github-app', () => ({
  isGitHubAppConfigured: jest.fn(() => false),
  getInstallationId: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../../lib/github-token', () => ({
  resolveGitHubToken: jest.fn(() => Promise.resolve({ token: null, source: 'none' })),
}));

const redis = require('../../lib/redis');
const axios = require('axios');
const { isGitHubAppConfigured, getInstallationId } = require('../../lib/github-app');
const { verifyRepo, verifyRepoViaApp, fetchRoadmapperFile, getCachedVerification, isVerificationStale } = require('../../lib/verify');
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

    test('verifies via GitHub App when installed', async () => {
      redis.hgetall.mockResolvedValueOnce(null); // No cached verification
      isGitHubAppConfigured.mockReturnValue(true);
      getInstallationId.mockResolvedValue('42');

      const result = await verifyRepo('owner', 'repo');
      expect(result).toEqual({ verified: true, tier: 'free' });
      // Should not fetch .roadmapper file
      expect(axios.get).not.toHaveBeenCalled();
      // Should cache the verification
      expect(redis.hset).toHaveBeenCalledWith(
        'repo:owner/repo',
        expect.objectContaining({ tier: 'free' })
      );
    });

    test('falls back to .roadmapper when app not installed', async () => {
      redis.hgetall.mockResolvedValueOnce(null); // No cached verification
      isGitHubAppConfigured.mockReturnValue(true);
      getInstallationId.mockResolvedValue(null);
      // .roadmapper file fetch succeeds
      const base64Content = Buffer.from(validKey).toString('base64');
      axios.get.mockResolvedValueOnce({ data: { content: base64Content } });
      redis.hgetall.mockResolvedValueOnce({ owner: 'owner', repo: 'repo', tier: 'free' });

      const result = await verifyRepo('owner', 'repo');
      expect(result).toEqual({ verified: true, tier: 'free' });
    });
  });

  describe('verifyRepoViaApp', () => {
    test('returns verified when app is configured and installed', async () => {
      isGitHubAppConfigured.mockReturnValue(true);
      getInstallationId.mockResolvedValue('42');

      const result = await verifyRepoViaApp('owner', 'repo');
      expect(result).toEqual({ verified: true, tier: 'free' });
    });

    test('returns not verified when app is not configured', async () => {
      isGitHubAppConfigured.mockReturnValue(false);

      const result = await verifyRepoViaApp('owner', 'repo');
      expect(result).toEqual({ verified: false });
    });

    test('returns not verified when app is configured but not installed', async () => {
      isGitHubAppConfigured.mockReturnValue(true);
      getInstallationId.mockResolvedValue(null);

      const result = await verifyRepoViaApp('owner', 'repo');
      expect(result).toEqual({ verified: false });
    });
  });
});
