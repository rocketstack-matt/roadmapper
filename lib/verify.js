const axios = require('axios');
const redis = require('./redis');
const { hashApiKey } = require('./keys');
const { VERIFICATION_TTL } = require('./tiers');

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
  const headers = {};
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
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
 * Verify a repo has a valid .roadmapper key file.
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

module.exports = { verifyRepo, getCachedVerification, cacheVerification, fetchRoadmapperFile, isVerificationStale };
