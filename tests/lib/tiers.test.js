const { TIERS, VERIFICATION_TTL, IP_RATE_LIMIT, getCacheTtl } = require('../../lib/tiers');

describe('lib/tiers', () => {
  test('defines free tier with correct cache TTL', () => {
    expect(TIERS.free.cacheTtl).toBe(3600);
  });

  test('defines free tier with rate limit config', () => {
    expect(TIERS.free.rateLimit.requests).toBe(60);
    expect(TIERS.free.rateLimit.window).toBe('1h');
  });

  test('defines paid tier with shorter cache TTL', () => {
    expect(TIERS.paid.cacheTtl).toBe(30);
  });

  test('defines paid tier with higher rate limit', () => {
    expect(TIERS.paid.rateLimit.requests).toBe(10000);
  });

  test('verification TTL is 24 hours', () => {
    expect(VERIFICATION_TTL).toBe(86400);
  });

  test('IP rate limit is defined', () => {
    expect(IP_RATE_LIMIT.requests).toBe(200);
    expect(IP_RATE_LIMIT.window).toBe('1h');
  });

  describe('getCacheTtl', () => {
    test('returns free tier TTL for free tier', () => {
      expect(getCacheTtl('free')).toBe(3600);
    });

    test('returns paid tier TTL for paid tier', () => {
      expect(getCacheTtl('paid')).toBe(30);
    });

    test('falls back to free tier TTL for unknown tier', () => {
      expect(getCacheTtl('unknown')).toBe(3600);
    });

    test('falls back to free tier TTL for undefined', () => {
      expect(getCacheTtl(undefined)).toBe(3600);
    });
  });
});
