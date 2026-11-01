#!/usr/bin/env node

/**
 * Update a repo's or a GitHub App installation's tier in Redis. Billing is
 * direct (Stripe/invoice) for now, so this is how an install is made paid.
 *
 * For a repo with the GitHub App installed this sets the tier of the whole
 * installation (every repo it covers), and of its API key if one is
 * registered.
 *
 * Usage:
 *   node scripts/set-tier.js <owner> <repo> <tier>
 *   node scripts/set-tier.js --installation <id> <tier>
 *
 * Examples:
 *   node scripts/set-tier.js rocketstack-matt roadmapper paid
 *   node scripts/set-tier.js --installation 12345678 paid
 *
 * The installation id is in the installation's settings URL
 * (github.com/settings/installations/<id>) and the post-install setup page URL.
 *
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env, and
 * GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY to find a repo's installation when
 * it isn't cached.
 */

require('dotenv').config();
const redis = require('../lib/redis');
const { getInstallationId, setInstallationTier } = require('../lib/github-app');
const { repoSlug } = require('../lib/repo-slug');

const usage = () => {
  console.error('Usage: node scripts/set-tier.js <owner> <repo> <tier>');
  console.error('       node scripts/set-tier.js --installation <id> <tier>');
  console.error('Example: node scripts/set-tier.js rocketstack-matt roadmapper paid');
  process.exit(1);
};

const args = process.argv.slice(2);
const byInstallation = args[0] === '--installation';
const [first, second, tier] = byInstallation ? [args[1], null, args[2]] : args;

if (!first || (!byInstallation && !second) || !tier) usage();

if (!['free', 'paid'].includes(tier)) {
  console.error(`Invalid tier "${tier}". Must be "free" or "paid".`);
  process.exit(1);
}

if (byInstallation && !/^\d+$/.test(first)) {
  console.error(`Invalid installation id "${first}". It must be a number.`);
  process.exit(1);
}

const updateInstallation = async (installationId) => {
  const repos = await setInstallationTier(installationId, tier);
  console.log(`Updated installation:${installationId} → tier: ${tier}`);
  if (repos.length) console.log(`Cleared verification cache for ${repos.join(', ')}`);
};

(async () => {
  if (byInstallation) {
    await updateInstallation(first);
    console.log(`Done. Installation ${first} is now on the "${tier}" tier.`);
    return;
  }

  const [owner, repo] = [first, second];

  // Find the key hash and GitHub App installation via reverse lookups
  const keyHash = await redis.get(`repo-key:${owner}/${repo}`);
  const installationId = await getInstallationId(owner, repo);
  if (!keyHash && !installationId) {
    console.error(`No API key or GitHub App installation found for ${owner}/${repo}`);
    process.exit(1);
  }

  // Update the tier on the API key record
  if (keyHash) {
    await redis.hset(`apikey:${keyHash}`, { tier });
    console.log(`Updated apikey:${keyHash} → tier: ${tier}`);
  }

  // Installed repos are verified with the installation's tier
  if (installationId) {
    await updateInstallation(installationId);
  }

  // Clear the cached verification so it picks up the new tier on next request
  await redis.del(`repo:${repoSlug(owner, repo)}`);
  await redis.del(`repo-ttl:${repoSlug(owner, repo)}`);
  console.log(`Cleared verification cache for ${owner}/${repo}`);

  console.log(`Done. ${owner}/${repo} is now on the "${tier}" tier.`);
})();
