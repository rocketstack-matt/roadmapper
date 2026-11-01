#!/usr/bin/env node

/**
 * Update a repo's or a GitHub App installation's manual tier in Redis. GitHub
 * Marketplace purchases set an installation's tier on their own (see
 * lib/marketplace.js); this is for direct deals and API-key repos. An
 * installation gets the higher of the two, so setting "free" here doesn't
 * cancel a Marketplace plan.
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
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env. A
 * repo's installation is read from the cached install:{owner}/{repo} mapping;
 * GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY are only needed to look it up on
 * GitHub when nothing is cached. If it can't be found either way, the script
 * says so and exits non-zero rather than report a tier it may not have set.
 */

require('dotenv').config();
const redis = require('../lib/redis');
const {
  isAppConfigured,
  getInstallationId,
  getInstallationTier,
  setInstallationTier,
  NOT_INSTALLED,
} = require('../lib/github-app');
const { repoSlug } = require('../lib/repo-slug');
const { getRepoKeyHash } = require('../lib/keys');

const usage = () => {
  console.error('Usage: node scripts/set-tier.js <owner> <repo> <tier>');
  console.error('       node scripts/set-tier.js --installation <id> <tier>');
  console.error('Example: node scripts/set-tier.js rocketstack-matt roadmapper paid');
  return 1;
};

/**
 * Find a repo's installation: `{ id }` (null = not installed), or
 * `{ unknown: true }` when nothing is cached and it couldn't be looked up
 * (App credentials unset, or the GitHub lookup failed).
 *
 * The cached install: mapping is read first whatever the credentials, because
 * getInstallationId() returns null without reading it when the App isn't
 * configured, which is the usual way to run this script.
 */
const findInstallation = async (owner, repo) => {
  const cacheKey = `install:${repoSlug(owner, repo)}`;
  const cached = await redis.get(cacheKey);
  if (cached === NOT_INSTALLED) return { id: null };
  if (cached) return { id: String(cached) };
  if (!isAppConfigured()) return { unknown: true };

  const id = await getInstallationId(owner, repo);
  if (id) return { id };
  // A 404 caches the not-installed marker; any other failure caches nothing.
  return (await redis.get(cacheKey)) === NOT_INSTALLED ? { id: null } : { unknown: true };
};

const main = async (args) => {
  const byInstallation = args[0] === '--installation';
  const [first, second, tier] = byInstallation ? [args[1], null, args[2]] : args;

  if (!first || (!byInstallation && !second) || !tier) return usage();

  if (!['free', 'paid'].includes(tier)) {
    console.error(`Invalid tier "${tier}". Must be "free" or "paid".`);
    return 1;
  }

  if (byInstallation && !/^\d+$/.test(first)) {
    console.error(`Invalid installation id "${first}". It must be a number.`);
    return 1;
  }

  const updateInstallation = async (installationId) => {
    const repos = await setInstallationTier(installationId, tier);
    console.log(`Updated installation:${installationId} → tier: ${tier}`);
    if (repos.length) console.log(`Cleared verification cache for ${repos.join(', ')}`);
    const effective = await getInstallationTier(installationId);
    if (effective !== tier) {
      console.log(`Installation ${installationId} stays on "${effective}": its account has a GitHub Marketplace plan.`);
    }
  };

  if (byInstallation) {
    await updateInstallation(first);
    console.log(`Done. Installation ${first} is now on the "${tier}" tier.`);
    return 0;
  }

  const [owner, repo] = [first, second];

  // Find the key hash and GitHub App installation via reverse lookups
  const keyHash = await getRepoKeyHash(owner, repo);
  const installation = await findInstallation(owner, repo);
  if (!keyHash && !installation.id && !installation.unknown) {
    console.error(`No API key or GitHub App installation found for ${owner}/${repo}`);
    return 1;
  }

  // Update the tier on the API key record
  if (keyHash) {
    await redis.hset(`apikey:${keyHash}`, { tier });
    console.log(`Updated apikey:${keyHash} → tier: ${tier}`);
  }

  // Installed repos are verified with the installation's tier
  if (installation.id) {
    await updateInstallation(installation.id);
  }

  // Clear the cached verification so it picks up the new tier on next request
  await redis.del(`repo:${repoSlug(owner, repo)}`);
  await redis.del(`repo-ttl:${repoSlug(owner, repo)}`);
  console.log(`Cleared verification cache for ${owner}/${repo}`);

  // The repo may be installed, but we couldn't find out: don't report success
  if (installation.unknown) {
    const why = isAppConfigured()
      ? 'the GitHub lookup failed'
      : 'GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY are not set';
    console.error(
      `Could not tell whether ${owner}/${repo} has the GitHub App installed: ` +
      `no install mapping is cached and ${why}. ` +
      (keyHash ? 'Only its API key was updated. ' : 'No tier was set. ') +
      `If it is installed, run: node scripts/set-tier.js --installation <id> ${tier}`
    );
    return 1;
  }

  console.log(`Done. ${owner}/${repo} is now on the "${tier}" tier.`);
  return 0;
};

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}

module.exports = { main, findInstallation };
