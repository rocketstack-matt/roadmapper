const { Redis } = require('@upstash/redis');

let redis;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
} else {
  // No-op fallback for local development without Redis
  redis = {
    get: async () => null,
    set: async () => 'OK',
    del: async () => 0,
    hgetall: async () => null,
    hset: async () => 0,
    exists: async () => 0,
    expire: async () => 0,
    persist: async () => 0,
  };
}

module.exports = redis;
