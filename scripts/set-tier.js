#!/usr/bin/env node

/**
 * Update a repo's tier in Redis.
 *
 * Usage:
 *   node scripts/set-tier.js <owner> <repo> <tier>
 *
 * Example:
 *   node scripts/set-tier.js rocketstack-matt roadmapper paid
 *
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env
 */

require('dotenv').config();
const redis = require('../lib/redis');

const [owner, repo, tier] = process.argv.slice(2);

if (!owner || !repo || !tier) {
  console.error('Usage: node scripts/set-tier.js <owner> <repo> <tier>');
  console.error('Example: node scripts/set-tier.js rocketstack-matt roadmapper paid');
  process.exit(1);
}

if (!['free', 'paid'].includes(tier)) {
  console.error(`Invalid tier "${tier}". Must be "free" or "paid".`);
  process.exit(1);
}

(async () => {
  // Find the key hash via reverse lookup
  const keyHash = await redis.get(`repo-key:${owner}/${repo}`);
  if (!keyHash) {
    console.error(`No API key registered for ${owner}/${repo}`);
    process.exit(1);
  }

  // Update the tier on the API key record
  await redis.hset(`apikey:${keyHash}`, { tier });
  console.log(`Updated apikey:${keyHash} → tier: ${tier}`);

  // Clear the cached verification so it picks up the new tier on next request
  await redis.del(`repo:${owner}/${repo}`);
  await redis.del(`repo-ttl:${owner}/${repo}`);
  console.log(`Cleared verification cache for ${owner}/${repo}`);

  console.log(`Done. ${owner}/${repo} is now on the "${tier}" tier.`);
})();
