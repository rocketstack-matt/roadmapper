const jwt = require('jsonwebtoken');
const axios = require('axios');
const redis = require('./redis');

/**
 * Check if GitHub App environment variables are configured.
 */
const isGitHubAppConfigured = () => {
  return !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
};

/**
 * Decode the GitHub App private key.
 * Supports both raw PEM and base64-encoded PEM (for Vercel).
 */
const decodePrivateKey = () => {
  const raw = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!raw) return null;
  // If it looks like a PEM, use as-is; otherwise decode from base64
  if (raw.startsWith('-----BEGIN')) {
    return raw;
  }
  return Buffer.from(raw, 'base64').toString('utf-8');
};

/**
 * Generate a JWT for GitHub App authentication.
 * JWTs expire after 10 minutes per GitHub spec.
 */
const generateAppJwt = () => {
  const privateKey = decodePrivateKey();
  if (!privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60, // Issued 60s ago to account for clock drift
    exp: now + (10 * 60), // 10-minute expiry
    iss: process.env.GITHUB_APP_ID,
  };

  return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
};

/**
 * Get the installation ID for a given repo.
 * Checks Redis cache first, then fetches from GitHub API.
 * Returns the installation ID (number) or null.
 */
const getInstallationId = async (owner, repo) => {
  // Check Redis cache
  const cacheKey = `gh-app:installation:${owner}/${repo}`;
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  // Fetch from GitHub API
  const appJwt = generateAppJwt();
  if (!appJwt) return null;

  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/installation`,
      {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );

    const installationId = String(response.data.id);
    // Cache the installation ID
    await redis.set(cacheKey, installationId);
    return installationId;
  } catch (error) {
    return null;
  }
};

/**
 * Get an installation access token for the given installation ID.
 * Checks Redis cache first, then exchanges JWT for a new token.
 * Tokens are cached for ~55 minutes (GitHub tokens expire after 60).
 */
const getInstallationToken = async (installationId) => {
  // Check Redis cache
  const cacheKey = `gh-app:token:${installationId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  // Exchange JWT for installation token
  const appJwt = generateAppJwt();
  if (!appJwt) return null;

  try {
    const response = await axios.post(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {},
      {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
        },
      }
    );

    const token = response.data.token;
    // Cache for 55 minutes (tokens expire at 60)
    await redis.set(cacheKey, token, { ex: 55 * 60 });
    return token;
  } catch (error) {
    return null;
  }
};

/**
 * Get a GitHub token for a specific repo via the GitHub App.
 * Returns the installation access token or null if the app is not installed.
 */
const getTokenForRepo = async (owner, repo) => {
  const installationId = await getInstallationId(owner, repo);
  if (!installationId) return null;

  return getInstallationToken(installationId);
};

module.exports = {
  isGitHubAppConfigured,
  generateAppJwt,
  getInstallationId,
  getInstallationToken,
  getTokenForRepo,
  decodePrivateKey,
};
