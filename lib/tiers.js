const TIERS = {
  free: {
    cacheTtl: 3600,       // 60 minutes
    rateLimit: { requests: 60, window: '1h' },
  },
  paid: {
    cacheTtl: 30,         // 30 seconds
    rateLimit: { requests: 10000, window: '1h' },
  },
};

const VERIFICATION_TTL = 86400; // 24 hours in seconds

const IP_RATE_LIMIT = { requests: 200, window: '1h' };

const getCacheTtl = (tier) => {
  return (TIERS[tier] && TIERS[tier].cacheTtl) || TIERS.free.cacheTtl;
};

module.exports = { TIERS, VERIFICATION_TTL, IP_RATE_LIMIT, getCacheTtl };
