const TIERS = {
  free: {
    cacheTtl: 3600,       // 60 minutes
    rateLimit: { requests: 1000, window: '1h' },
  },
  paid: {
    cacheTtl: 30,         // 30 seconds
    rateLimit: { requests: 10000, window: '1h' },
  },
};

const VERIFICATION_TTL = 86400; // 24 hours in seconds

// Soft cache TTL for paid repos with the GitHub App installed. Webhooks
// invalidate their cache as soon as an issue changes, so this is only a safety
// net in case a webhook delivery is missed.
const WEBHOOK_CACHE_TTL = 900; // 15 minutes

const IP_RATE_LIMIT = { requests: 2000, window: '1h' };

const getCacheTtl = (tier) => {
  return (TIERS[tier] && TIERS[tier].cacheTtl) || TIERS.free.cacheTtl;
};

module.exports = { TIERS, VERIFICATION_TTL, WEBHOOK_CACHE_TTL, IP_RATE_LIMIT, getCacheTtl };
