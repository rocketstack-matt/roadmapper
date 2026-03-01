const axios = require('axios');
const redis = require('./redis');
const { hashApiKey } = require('./keys');
const { VERIFICATION_TTL } = require('./tiers');
const { isGitHubAppConfigured, getInstallationId } = require('./github-app');
const { resolveGitHubToken } = require('./github-token');

const getCachedVerification = async (owner, repo) => {
  const data = await redis.hgetall(`repo:${owner}/${repo}`);
  if (data && data.tier) {
    return data;
  }
  return null;
};

const cacheVerification = async (owner, repo, tier) => {
  await redis.hset(`repo:${owner}/${repo}`, {
    tier,
    verifiedAt: new Date().toISOString(),
  });
  // Set TTL on the verification cache (24 hours)
  await redis.set(`repo-ttl:${owner}/${repo}`, '1', { ex: VERIFICATION_TTL });
};

const isVerificationStale = async (owner, repo) => {
  const ttlMarker = await redis.get(`repo-ttl:${owner}/${repo}`);
  return !ttlMarker;
};

const fetchRoadmapperFile = async (owner, repo) => {
  const { token } = await resolveGitHubToken(owner, repo);
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
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

/**
 * Check if a repo has the GitHub App installed.
 * Returns { verified: true, tier: 'free' } or { verified: false }.
 */
const verifyRepoViaApp = async (owner, repo) => {
  if (!isGitHubAppConfigured()) {
    return { verified: false };
  }

  const installationId = await getInstallationId(owner, repo);
  if (installationId) {
    return { verified: true, tier: 'free' };
  }
  return { verified: false };
};

/**
 * Verify a repo has a valid .roadmapper key file or GitHub App installation.
 * Returns { verified: true, tier } or { verified: false, reason }.
 */
const verifyRepo = async (owner, repo) => {
  // Check cached verification first
  const cached = await getCachedVerification(owner, repo);
  if (cached) {
    const stale = await isVerificationStale(owner, repo);
    if (!stale) {
      return { verified: true, tier: cached.tier };
    }
  }

  // Try GitHub App verification first
  const appResult = await verifyRepoViaApp(owner, repo);
  if (appResult.verified) {
    await cacheVerification(owner, repo, appResult.tier);
    return { verified: true, tier: appResult.tier };
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
  if (keyData.owner !== owner || keyData.repo !== repo) {
    return { verified: false, reason: 'API key does not match this repository' };
  }

  // Check if email has been confirmed
  if (keyData.emailConfirmed === 'false') {
    return { verified: false, reason: 'Email not yet confirmed. Please check your inbox and click the confirmation link.' };
  }

  // Cache the verification
  await cacheVerification(owner, repo, keyData.tier);

  return { verified: true, tier: keyData.tier };
};

module.exports = { verifyRepo, verifyRepoViaApp, getCachedVerification, cacheVerification, fetchRoadmapperFile, isVerificationStale };
