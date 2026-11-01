#!/usr/bin/env node

/**
 * Update a repo's tier in Redis. For a repo with the GitHub App installed this
 * sets the tier of the whole installation (every repo it covers).
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
const { NOT_INSTALLED } = require('../lib/github-app');
const { repoSlug } = require('../lib/repo-slug');

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
  // Find the key hash and GitHub App installation via reverse lookups
  const keyHash = await redis.get(`repo-key:${owner}/${repo}`);
  const installationId = await redis.get(`install:${repoSlug(owner, repo)}`);
  const installed = installationId && installationId !== NOT_INSTALLED;
  if (!keyHash && !installed) {
    console.error(`No API key or GitHub App installation found for ${owner}/${repo}`);
    process.exit(1);
  }

  // Update the tier on the API key record
  if (keyHash) {
    await redis.hset(`apikey:${keyHash}`, { tier });
    console.log(`Updated apikey:${keyHash} → tier: ${tier}`);
  }

  // Installed repos are verified with the installation's tier
  if (installed) {
    await redis.hset(`installation:${installationId}`, { tier });
    console.log(`Updated installation:${installationId} → tier: ${tier}`);
  }

  // Clear the cached verification so it picks up the new tier on next request
  await redis.del(`repo:${repoSlug(owner, repo)}`);
  await redis.del(`repo-ttl:${repoSlug(owner, repo)}`);
  console.log(`Cleared verification cache for ${owner}/${repo}`);

  console.log(`Done. ${owner}/${repo} is now on the "${tier}" tier.`);
})();
