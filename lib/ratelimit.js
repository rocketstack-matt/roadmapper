const { Ratelimit } = require('@upstash/ratelimit');
const redis = require('./redis');
const { TIERS, IP_RATE_LIMIT } = require('./tiers');

// Check if we have a real Redis connection (not the no-op fallback)
const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// Create rate limiters per tier (only if Redis is available)
const rateLimiters = {};
const ipRateLimiter = hasRedis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(IP_RATE_LIMIT.requests, IP_RATE_LIMIT.window),
      prefix: 'ratelimit:ip',
      ephemeralCache: false,
    })
  : null;

if (hasRedis) {
  for (const [tier, config] of Object.entries(TIERS)) {
    rateLimiters[tier] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.rateLimit.requests, config.rateLimit.window),
      prefix: `ratelimit:${tier}`,
      ephemeralCache: false,
    });
  }
}

/**
 * Check rate limit for a repo.
 * Returns { success, limit, remaining, reset }.
 */
const checkRepoRateLimit = async (owner, repo, tier) => {
  if (!hasRedis || !rateLimiters[tier]) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  const identifier = `repo:${owner}/${repo}`;
  const result = await rateLimiters[tier].limit(identifier);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
};

/**
 * Check IP-based abuse backstop.
 */
const checkIpRateLimit = async (ip) => {
  if (!hasRedis || !ipRateLimiter) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  const result = await ipRateLimiter.limit(ip);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
};

module.exports = { checkRepoRateLimit, checkIpRateLimit };
