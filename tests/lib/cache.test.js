jest.mock('../../lib/redis', () => ({
  get: jest.fn(() => Promise.resolve(null)),
  set: jest.fn(() => Promise.resolve('OK')),
  del: jest.fn(() => Promise.resolve(1)),
}));

const redis = require('../../lib/redis');
const { getCachedIssues, cacheIssues, invalidateIssues, isCacheFresh } = require('../../lib/cache');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('lib/cache', () => {
  const mockIssues = [
    { number: 1, title: 'Issue 1', labels: [{ name: 'Roadmap: Now', color: '2da44e' }] },
    { number: 2, title: 'Issue 2', labels: [{ name: 'Roadmap: Next', color: 'fb8500' }] },
  ];

  describe('getCachedIssues', () => {
    test('returns null on cache miss', async () => {
      redis.get.mockResolvedValue(null);
      const result = await getCachedIssues('owner', 'repo');
      expect(result).toBeNull();
    });

    test('returns cache object on hit (string)', async () => {
      const cacheData = { issues: mockIssues, etag: '"abc123"', cachedAt: 1000 };
      redis.get.mockResolvedValue(JSON.stringify(cacheData));
      const result = await getCachedIssues('owner', 'repo');
      expect(result).toEqual(cacheData);
    });

    test('returns cache object directly if already parsed', async () => {
      const cacheData = { issues: mockIssues, etag: '"abc123"', cachedAt: 1000 };
      redis.get.mockResolvedValue(cacheData);
      const result = await getCachedIssues('owner', 'repo');
      expect(result).toEqual(cacheData);
    });

    test('wraps plain array (old format) as cache object', async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockIssues));
      const result = await getCachedIssues('owner', 'repo');
      expect(result).toEqual({ issues: mockIssues, etag: null, cachedAt: 0 });
    });

    test('wraps plain array (already parsed) as cache object', async () => {
      redis.get.mockResolvedValue(mockIssues);
      const result = await getCachedIssues('owner', 'repo');
      expect(result).toEqual({ issues: mockIssues, etag: null, cachedAt: 0 });
    });

    test('uses correct cache key', async () => {
      await getCachedIssues('facebook', 'react');
      expect(redis.get).toHaveBeenCalledWith('cache:issues:facebook/react');
    });

    test('lowercases the cache key, as GitHub names are case-insensitive', async () => {
      await getCachedIssues('Facebook', 'React');
      expect(redis.get).toHaveBeenCalledWith('cache:issues:facebook/react');
    });
  });

  describe('cacheIssues', () => {
    test('stores cache object with no Redis TTL', async () => {
      const before = Date.now();
      await cacheIssues('owner', 'repo', mockIssues, 3600);
      const after = Date.now();

      expect(redis.set).toHaveBeenCalledTimes(1);
      const [key, value] = redis.set.mock.calls[0];
      expect(key).toBe('cache:issues:owner/repo');

      const parsed = JSON.parse(value);
      expect(parsed.issues).toEqual(mockIssues);
      expect(parsed.etag).toBeNull();
      expect(parsed.cachedAt).toBeGreaterThanOrEqual(before);
      expect(parsed.cachedAt).toBeLessThanOrEqual(after);

      // No TTL options passed
      expect(redis.set.mock.calls[0].length).toBe(2);
    });

    test('stores etag when provided', async () => {
      await cacheIssues('owner', 'repo', mockIssues, 3600, '"etag-value"');

      const parsed = JSON.parse(redis.set.mock.calls[0][1]);
      expect(parsed.etag).toBe('"etag-value"');
    });

    test('stores null etag by default', async () => {
      await cacheIssues('owner', 'repo', mockIssues, 3600);

      const parsed = JSON.parse(redis.set.mock.calls[0][1]);
      expect(parsed.etag).toBeNull();
    });

    test('stores the fetch start time as cachedAt', async () => {
      await cacheIssues('owner', 'repo', mockIssues, 3600, null, 12345);

      const parsed = JSON.parse(redis.set.mock.calls[0][1]);
      expect(parsed.cachedAt).toBe(12345);
    });

    test('stores issues already stale when invalidated after the fetch started', async () => {
      redis.get.mockResolvedValueOnce('2000');
      await cacheIssues('owner', 'repo', mockIssues, 3600, null, 1000);

      expect(redis.get).toHaveBeenCalledWith('cache:invalidated:owner/repo');
      const parsed = JSON.parse(redis.set.mock.calls[0][1]);
      expect(parsed.issues).toEqual(mockIssues);
      expect(parsed.cachedAt).toBe(0);
    });

    test('stores issues fresh when invalidated before the fetch started', async () => {
      redis.get.mockResolvedValueOnce('500');
      await cacheIssues('owner', 'repo', mockIssues, 3600, null, 1000);

      const parsed = JSON.parse(redis.set.mock.calls[0][1]);
      expect(parsed.cachedAt).toBe(1000);
    });

    test('always stores (ttlSeconds no longer controls storage)', async () => {
      await cacheIssues('owner', 'repo', mockIssues, 0);
      expect(redis.set).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidateIssues', () => {
    test('records an invalidation marker and deletes the cached issues', async () => {
      const before = Date.now();
      await invalidateIssues('Owner', 'Repo');

      const [key, value, options] = redis.set.mock.calls[0];
      expect(key).toBe('cache:invalidated:owner/repo');
      expect(Number(value)).toBeGreaterThanOrEqual(before);
      expect(options).toEqual({ ex: 86400 });
      expect(redis.del).toHaveBeenCalledWith('cache:issues:owner/repo');
    });
  });

  describe('isCacheFresh', () => {
    test('returns true when cache is within TTL', () => {
      const cacheData = { issues: mockIssues, etag: '"abc"', cachedAt: Date.now() - 1000 };
      expect(isCacheFresh(cacheData, 3600)).toBe(true);
    });

    test('returns false when cache is expired', () => {
      const cacheData = { issues: mockIssues, etag: '"abc"', cachedAt: Date.now() - 4000000 };
      expect(isCacheFresh(cacheData, 3600)).toBe(false);
    });

    test('returns false at exact boundary', () => {
      const cacheData = { issues: mockIssues, etag: '"abc"', cachedAt: Date.now() - 3600000 };
      expect(isCacheFresh(cacheData, 3600)).toBe(false);
    });

    test('returns false for null cacheData', () => {
      expect(isCacheFresh(null, 3600)).toBe(false);
    });

    test('returns false when cachedAt is missing', () => {
      const cacheData = { issues: mockIssues, etag: '"abc"' };
      expect(isCacheFresh(cacheData, 3600)).toBe(false);
    });

    test('returns false when cachedAt is 0 (backward-compat entry)', () => {
      const cacheData = { issues: mockIssues, etag: null, cachedAt: 0 };
      expect(isCacheFresh(cacheData, 3600)).toBe(false);
    });
  });
});
