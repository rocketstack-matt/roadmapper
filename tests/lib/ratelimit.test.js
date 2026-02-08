// Note: Without actual Redis env vars, the rate limiter returns pass-through results.
// We test the exported functions work correctly with the no-op Redis fallback.

const { checkRepoRateLimit, checkIpRateLimit } = require('../../lib/ratelimit');

describe('lib/ratelimit', () => {
  describe('checkRepoRateLimit (without Redis)', () => {
    test('returns success when Redis not configured', async () => {
      const result = await checkRepoRateLimit('owner', 'repo', 'free');
      expect(result.success).toBe(true);
    });
  });

  describe('checkIpRateLimit (without Redis)', () => {
    test('returns success when Redis not configured', async () => {
      const result = await checkIpRateLimit('1.2.3.4');
      expect(result.success).toBe(true);
    });
  });
});
