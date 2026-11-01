#!/usr/bin/env node

/**
 * Copy every repo-key:{Owner}/{Repo} reverse lookup written before case-folding
 * to its lowercased name, keeping any TTL (unconfirmed registrations). Safe to
 * run more than once; the original keys are left in place.
 *
 * Usage:
 *   node scripts/fold-repo-keys.js
 *
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env
 */

require('dotenv').config();
const redis = require('../lib/redis');

(async () => {
  if (!redis.scan) {
    console.error('Redis is not configured');
    process.exit(1);
  }

  let cursor = '0';
  let copied = 0;
  do {
    const [next, keys] = await redis.scan(cursor, { match: 'repo-key:*', count: 100 });
    cursor = String(next);
    for (const key of keys) {
      const folded = key.toLowerCase();
      if (folded === key) continue;
      const hash = await redis.get(key);
      if (!hash) continue;
      const ttl = await redis.ttl(key);
      await redis.set(folded, hash, ttl > 0 ? { ex: ttl, nx: true } : { nx: true });
      console.log(`${key} → ${folded}`);
      copied++;
    }
  } while (cursor !== '0');

  console.log(`Done. Copied ${copied} key(s).`);
})();
