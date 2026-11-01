const axios = require('axios');
const redis = require('./redis');
const { hashApiKey, getRepoKeyHash } = require('./keys');
const { TIERS, VERIFICATION_TTL } = require('./tiers');
const { repoSlug } = require('./repo-slug');
const {
  getInstallationId,
  getInstallationTier,
  getGitHubHeaders,
  PrivateRepoError,
  AppAuthError,
} = require('./github-app');

const getCachedVerification = async (owner, repo) => {
  const data = await redis.hgetall(`repo:${repoSlug(owner, repo)}`);
  if (data && data.tier) {
    return data;
  }
  return null;
};

// source is 'app' (verified by the GitHub App installation) or 'key' (a
// .roadmapper file). An 'app' verification only holds while the App is
// installed; entries without a source predate the App and came from a key.
const cacheVerification = async (owner, repo, tier, source = 'key') => {
  await redis.hset(`repo:${repoSlug(owner, repo)}`, {
    tier,
    source,
    verifiedAt: new Date().toISOString(),
  });
  // Set TTL on the verification cache (24 hours)
  await redis.set(`repo-ttl:${repoSlug(owner, repo)}`, '1', { ex: VERIFICATION_TTL });
};

const isVerificationStale = async (owner, repo) => {
  const ttlMarker = await redis.get(`repo-ttl:${repoSlug(owner, repo)}`);
  return !ttlMarker;
};

const fetchRoadmapperFile = async (owner, repo) => {
  try {
    const headers = await getGitHubHeaders(owner, repo);
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/.roadmapper`,
      { headers }
    );

    // GitHub returns file content as base64
    if (response.data && response.data.content) {
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8').trim();
      return content;
    }
    return null;
  } catch (error) {
    return null;
  }
};

// The higher of two tiers, by their order in TIERS (free, then paid).
const higherTier = (a, b) => {
  const order = Object.keys(TIERS);
  return order.indexOf(b) > order.indexOf(a) ? b : a;
};

/**
 * Tier of the confirmed API key registered for a repo, or free. An App
 * install must not drop a repo with a paid key to the installation's tier.
 */
const getKeyTier = async (owner, repo) => {
  const hash = await getRepoKeyHash(owner, repo);
  if (!hash) return 'free';
  const keyData = await redis.hgetall(`apikey:${hash}`);
  if (!keyData || keyData.emailConfirmed === 'false') return 'free';
  return keyData.tier || 'free';
};

/**
 * The repo's App installation id, or null when it has none, after checking
 * the installation can read it and it is public (getGitHubHeaders throws
 * otherwise). An AppAuthError drops the cached installation, so one retry
 * finds an uninstalled repo not installed.
 */
const getUsableInstallation = async (owner, repo, retry = true) => {
  const installationId = await getInstallationId(owner, repo);
  if (!installationId) return null;
  try {
    await getGitHubHeaders(owner, repo);
    return installationId;
  } catch (error) {
    if (retry && error instanceof AppAuthError) return getUsableInstallation(owner, repo, false);
    throw error;
  }
};

/**
 * Verify a repo has the GitHub App installed or a valid .roadmapper key file.
 * Returns { verified: true, tier, source } or { verified: false, reason }.
 */
const verifyRepo = async (owner, repo) => {
  // Checked on every request, before any cached verification is trusted: a
  // private repo in an installation is refused (visibility is re-checked every
  // minute, so one made private stops being served), and so is an installed
  // repo whose installation can't be used.
  let installationId;
  try {
    installationId = await getUsableInstallation(owner, repo);
  } catch (error) {
    if (error instanceof PrivateRepoError) {
      await redis.del(`cache:issues:${repoSlug(owner, repo)}`);
      return { verified: false, reason: 'Private repositories are not supported yet' };
    }
    console.error(error.message);
    return { verified: false, reason: 'Could not read this repository through the GitHub App. Please try again later.' };
  }

  // Check cached verification first. One made by the App no longer holds once
  // the App is uninstalled: the repo then needs its own .roadmapper file.
  const cached = await getCachedVerification(owner, repo);
  if (cached && (cached.source !== 'app' || installationId)) {
    const stale = await isVerificationStale(owner, repo);
    if (!stale) {
      return { verified: true, tier: cached.tier, source: cached.source || 'key' };
    }
  }

  // A repo with the GitHub App installed needs no .roadmapper file
  if (installationId) {
    const tier = higherTier(await getInstallationTier(installationId), await getKeyTier(owner, repo));
    await cacheVerification(owner, repo, tier, 'app');
    return { verified: true, tier, source: 'app' };
  }

  // Fetch .roadmapper file from the repo
  const keyContent = await fetchRoadmapperFile(owner, repo);
  if (!keyContent) {
    return { verified: false, reason: 'No .roadmapper file found in repository' };
  }

  // Validate the key format
  if (!keyContent.startsWith('rm_') || keyContent.length !== 35) {
    return { verified: false, reason: 'Invalid key format in .roadmapper file' };
  }

  // Look up the key in Redis
  const hash = hashApiKey(keyContent);
  const keyData = await redis.hgetall(`apikey:${hash}`);
  if (!keyData || !keyData.owner) {
    return { verified: false, reason: 'Unregistered API key in .roadmapper file' };
  }

  // Verify the key matches this repo
  if (repoSlug(keyData.owner, keyData.repo) !== repoSlug(owner, repo)) {
    return { verified: false, reason: 'API key does not match this repository' };
  }

  // Check if email has been confirmed
  if (keyData.emailConfirmed === 'false') {
    return { verified: false, reason: 'Email not yet confirmed. Please check your inbox and click the confirmation link.' };
  }

  // Cache the verification
  await cacheVerification(owner, repo, keyData.tier, 'key');

  return { verified: true, tier: keyData.tier, source: 'key' };
};

module.exports = { verifyRepo, getCachedVerification, cacheVerification, fetchRoadmapperFile, isVerificationStale };
