jest.mock('../../lib/redis', () => ({
  get: jest.fn(() => Promise.resolve(null)),
  set: jest.fn(() => Promise.resolve('OK')),
}));

const redis = require('../../lib/redis');
const { getCachedIssues, cacheIssues } = require('../../lib/cache');

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

    test('returns parsed issues on cache hit (string)', async () => {
      redis.get.mockResolvedValue(JSON.stringify(mockIssues));
      const result = await getCachedIssues('owner', 'repo');
      expect(result).toEqual(mockIssues);
    });

    test('returns issues directly if already parsed (object)', async () => {
      redis.get.mockResolvedValue(mockIssues);
      const result = await getCachedIssues('owner', 'repo');
      expect(result).toEqual(mockIssues);
    });

    test('uses correct cache key', async () => {
      await getCachedIssues('facebook', 'react');
      expect(redis.get).toHaveBeenCalledWith('cache:issues:facebook/react');
    });
  });

  describe('cacheIssues', () => {
    test('stores issues with TTL', async () => {
      await cacheIssues('owner', 'repo', mockIssues, 3600);
      expect(redis.set).toHaveBeenCalledWith(
        'cache:issues:owner/repo',
        JSON.stringify(mockIssues),
        { ex: 3600 }
      );
    });

    test('does not cache when TTL is 0', async () => {
      await cacheIssues('owner', 'repo', mockIssues, 0);
      expect(redis.set).not.toHaveBeenCalled();
    });

    test('does not cache when TTL is undefined', async () => {
      await cacheIssues('owner', 'repo', mockIssues, undefined);
      expect(redis.set).not.toHaveBeenCalled();
    });
  });
});
