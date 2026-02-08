// Set env vars BEFORE requiring middleware so hasRedis is true in tests
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

jest.mock('../../lib/verify', () => ({
  verifyRepo: jest.fn(),
}));

jest.mock('../../lib/ratelimit', () => ({
  checkRepoRateLimit: jest.fn(() => Promise.resolve({ success: true, limit: 60, remaining: 59, reset: Date.now() + 3600000 })),
  checkIpRateLimit: jest.fn(() => Promise.resolve({ success: true, limit: 200, remaining: 199, reset: Date.now() + 3600000 })),
}));

const { withMiddleware, extractOwnerRepo, getClientIp, isSvgEndpoint } = require('../../lib/middleware');
const { verifyRepo } = require('../../lib/verify');
const { checkRepoRateLimit, checkIpRateLimit } = require('../../lib/ratelimit');
const { createMockReq, createMockRes } = require('../helpers');

afterAll(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

beforeEach(() => {
  jest.clearAllMocks();
  // Re-set default mocks after clearAllMocks resets factory implementations
  checkIpRateLimit.mockResolvedValue({ success: true, limit: 200, remaining: 199, reset: Date.now() + 3600000 });
  checkRepoRateLimit.mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: Date.now() + 3600000 });
});

describe('lib/middleware', () => {
  describe('extractOwnerRepo', () => {
    test('extracts from root route', () => {
      expect(extractOwnerRepo('/facebook/react/ffffff/24292f')).toEqual({ owner: 'facebook', repo: 'react' });
    });

    test('extracts from view route', () => {
      expect(extractOwnerRepo('/view/facebook/react/ffffff/24292f')).toEqual({ owner: 'facebook', repo: 'react' });
    });

    test('extracts from embed route', () => {
      expect(extractOwnerRepo('/embed/facebook/react/ffffff/24292f')).toEqual({ owner: 'facebook', repo: 'react' });
    });

    test('extracts from html route', () => {
      expect(extractOwnerRepo('/html/facebook/react/ffffff/24292f')).toEqual({ owner: 'facebook', repo: 'react' });
    });

    test('strips query strings', () => {
      expect(extractOwnerRepo('/facebook/react/ffffff/24292f?foo=bar')).toEqual({ owner: 'facebook', repo: 'react' });
    });

    test('returns null for root path', () => {
      expect(extractOwnerRepo('/')).toBeNull();
    });
  });

  describe('getClientIp', () => {
    test('extracts IP from x-forwarded-for header', () => {
      const req = createMockReq('/', { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
      expect(getClientIp(req)).toBe('1.2.3.4');
    });

    test('returns unknown when no IP info', () => {
      const req = createMockReq('/');
      expect(getClientIp(req)).toBe('unknown');
    });
  });

  describe('isSvgEndpoint', () => {
    test('returns true for root roadmap URL', () => {
      expect(isSvgEndpoint('/owner/repo/ffffff/24292f')).toBe(true);
    });

    test('returns false for view URL', () => {
      expect(isSvgEndpoint('/view/owner/repo/ffffff/24292f')).toBe(false);
    });

    test('returns false for embed URL', () => {
      expect(isSvgEndpoint('/embed/owner/repo/ffffff/24292f')).toBe(false);
    });

    test('returns false for html URL', () => {
      expect(isSvgEndpoint('/html/owner/repo/ffffff/24292f')).toBe(false);
    });
  });

  describe('withMiddleware', () => {
    test('passes through with skipAll option', async () => {
      const innerHandler = jest.fn();
      const handler = withMiddleware(innerHandler, { skipAll: true });

      const req = createMockReq('/');
      const res = createMockRes();
      await handler(req, res);

      expect(innerHandler).toHaveBeenCalledWith(req, res);
      expect(verifyRepo).not.toHaveBeenCalled();
    });

    test('verifies repo and passes through on success', async () => {
      verifyRepo.mockResolvedValue({ verified: true, tier: 'free' });

      const innerHandler = jest.fn();
      const handler = withMiddleware(innerHandler);

      const req = createMockReq('/owner/repo/ffffff/24292f');
      const res = createMockRes();
      await handler(req, res);

      expect(verifyRepo).toHaveBeenCalledWith('owner', 'repo');
      expect(innerHandler).toHaveBeenCalled();
      expect(req.tier).toBe('free');
      expect(req.cacheTtl).toBe(3600);
    });

    test('returns 403 for unregistered repo', async () => {
      verifyRepo.mockResolvedValue({ verified: false, reason: 'No .roadmapper file found' });

      const innerHandler = jest.fn();
      const handler = withMiddleware(innerHandler);

      const req = createMockReq('/owner/repo/ffffff/24292f');
      const res = createMockRes();
      await handler(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toContain('Roadmap not registered');
      expect(innerHandler).not.toHaveBeenCalled();
    });

    test('returns error SVG for unregistered SVG endpoint', async () => {
      verifyRepo.mockResolvedValue({ verified: false, reason: 'No .roadmapper file' });

      const innerHandler = jest.fn();
      const handler = withMiddleware(innerHandler);

      const req = createMockReq('/owner/repo/ffffff/24292f');
      const res = createMockRes();
      await handler(req, res);

      expect(res.headers['Content-Type']).toBe('image/svg+xml');
      expect(res.body).toContain('<svg');
    });

    test('returns error HTML for unregistered HTML endpoint', async () => {
      verifyRepo.mockResolvedValue({ verified: false, reason: 'No .roadmapper file' });

      const innerHandler = jest.fn();
      const handler = withMiddleware(innerHandler);

      const req = createMockReq('/view/owner/repo/ffffff/24292f');
      const res = createMockRes();
      await handler(req, res);

      expect(res.headers['Content-Type']).toBe('text/html');
      expect(res.body).toContain('<!DOCTYPE html>');
    });

    test('returns 429 when repo rate limit exceeded', async () => {
      verifyRepo.mockResolvedValue({ verified: true, tier: 'free' });
      checkRepoRateLimit.mockResolvedValue({ success: false, limit: 60, remaining: 0, reset: Date.now() + 3600000 });

      const innerHandler = jest.fn();
      const handler = withMiddleware(innerHandler);

      const req = createMockReq('/owner/repo/ffffff/24292f');
      const res = createMockRes();
      await handler(req, res);

      expect(res.statusCode).toBe(429);
      expect(innerHandler).not.toHaveBeenCalled();
    });

    test('returns 429 when IP rate limit exceeded', async () => {
      checkIpRateLimit.mockResolvedValue({ success: false, limit: 200, remaining: 0, reset: Date.now() + 3600000 });

      const innerHandler = jest.fn();
      const handler = withMiddleware(innerHandler);

      const req = createMockReq('/owner/repo/ffffff/24292f');
      const res = createMockRes();
      await handler(req, res);

      expect(res.statusCode).toBe(429);
      expect(innerHandler).not.toHaveBeenCalled();
    });

    test('sets rate limit headers on successful request', async () => {
      verifyRepo.mockResolvedValue({ verified: true, tier: 'free' });
      checkRepoRateLimit.mockResolvedValue({ success: true, limit: 60, remaining: 55, reset: 1234567890 });

      const innerHandler = jest.fn();
      const handler = withMiddleware(innerHandler);

      const req = createMockReq('/owner/repo/ffffff/24292f');
      const res = createMockRes();
      await handler(req, res);

      expect(res.headers['X-RateLimit-Limit']).toBe(60);
      expect(res.headers['X-RateLimit-Remaining']).toBe(55);
      expect(res.headers['X-RateLimit-Reset']).toBe(1234567890);
    });

    test('ipRateLimitOnly skips repo verification', async () => {
      const innerHandler = jest.fn();
      const handler = withMiddleware(innerHandler, { ipRateLimitOnly: true });

      const req = createMockReq('/api/register');
      const res = createMockRes();
      await handler(req, res);

      expect(verifyRepo).not.toHaveBeenCalled();
      expect(innerHandler).toHaveBeenCalled();
    });

    test('passes through when URL has no owner/repo', async () => {
      const innerHandler = jest.fn();
      const handler = withMiddleware(innerHandler);

      const req = createMockReq('/');
      const res = createMockRes();
      await handler(req, res);

      expect(verifyRepo).not.toHaveBeenCalled();
      expect(innerHandler).toHaveBeenCalled();
    });
  });
});
