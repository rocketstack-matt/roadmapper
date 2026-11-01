const crypto = require('crypto');
const axios = require('axios');
const redis = require('./redis');
const { VERIFICATION_TTL } = require('./tiers');

const GITHUB_API = 'https://api.github.com';

// Installation tokens live for an hour; refresh this long before they expire
// so a token handed out is never about to lapse mid-request.
const TOKEN_REFRESH_MARGIN = 5 * 60;

// Marker cached for repos without the App, so the installation lookup isn't
// repeated on every request. Short, so a fresh install is picked up quickly.
const NOT_INSTALLED = 'none';
const NOT_INSTALLED_TTL = 10 * 60;

// Repo → installation mappings expire so the lazy lookup notices a repo being
// removed from an installation (until webhooks keep them current).
const INSTALLATION_TTL = VERIFICATION_TTL;

// Check at runtime (not module load time, for testability)
const isAppConfigured = () => !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);

const base64url = (value) => Buffer.from(value).toString('base64url');

// Env var UIs often store a PEM on one line with literal "\n" escapes.
const getPrivateKey = () => process.env.GITHUB_APP_PRIVATE_KEY.trim().replace(/\\n/g, '\n');

/**
 * Sign a GitHub App JWT (RS256). iat is backdated 60s to allow for clock
 * drift; GitHub rejects an exp more than 10 minutes out.
 */
const createAppJwt = (now = Date.now()) => {
  const seconds = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iat: seconds - 60,
    exp: seconds + 9 * 60,
    iss: String(process.env.GITHUB_APP_ID).trim(),
  }));
  const signature = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), getPrivateKey());
  return `${header}.${payload}.${signature.toString('base64url')}`;
};

const appHeaders = () => ({
  Authorization: `Bearer ${createAppJwt()}`,
  Accept: 'application/vnd.github+json',
});

/**
 * Record an installation's account, repos and tier. The tier is left alone if
 * already set, so a paid installation isn't reset by a later lookup.
 */
const recordInstallation = async (installation, owner, repo) => {
  const key = `installation:${installation.id}`;
  const existing = (await redis.hgetall(key)) || {};
  let repos = [];
  try {
    repos = Array.isArray(existing.repos) ? existing.repos : JSON.parse(existing.repos || '[]');
  } catch (e) {
    repos = [];
  }
  const fullName = `${owner}/${repo}`;
  if (!repos.includes(fullName)) repos.push(fullName);

  await redis.hset(key, {
    account: installation.account ? installation.account.login : owner,
    repos: JSON.stringify(repos),
    tier: existing.tier || 'free',
  });
};

/**
 * Return the App installation id for a repo, or null if the App isn't
 * configured or isn't installed on it. Looked up lazily via
 * GET /repos/{owner}/{repo}/installation and cached in Redis.
 */
const getInstallationId = async (owner, repo) => {
  if (!isAppConfigured()) return null;

  const cacheKey = `install:${owner}/${repo}`;
  const cached = await redis.get(cacheKey);
  if (cached === NOT_INSTALLED) return null;
  if (cached) return String(cached);

  try {
    const response = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}/installation`, { headers: appHeaders() });
    const id = String(response.data.id);
    await redis.set(cacheKey, id, { ex: INSTALLATION_TTL });
    await recordInstallation(response.data, owner, repo);
    return id;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      await redis.set(cacheKey, NOT_INSTALLED, { ex: NOT_INSTALLED_TTL });
    } else {
      // Bad App credentials or a GitHub outage: don't cache, fall back for now.
      console.error(`GitHub App installation lookup failed for ${owner}/${repo}: ${error.message}`);
    }
    return null;
  }
};

/**
 * Return an installation access token, minting one via
 * POST /app/installations/{id}/access_tokens when none is cached.
 */
const getInstallationToken = async (installationId) => {
  const cacheKey = `install-token:${installationId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return String(cached);

  const response = await axios.post(
    `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
    {},
    { headers: appHeaders() }
  );
  const { token, expires_at: expiresAt } = response.data;
  const ttl = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000) - TOKEN_REFRESH_MARGIN;
  if (ttl > 0) {
    await redis.set(cacheKey, token, { ex: ttl });
  }
  return token;
};

/**
 * GitHub auth headers for reading a repo: the App installation token when the
 * App is installed on it, otherwise the shared GITHUB_TOKEN (or none).
 */
const getGitHubHeaders = async (owner, repo) => {
  const installationId = await getInstallationId(owner, repo);
  if (installationId) {
    try {
      const token = await getInstallationToken(installationId);
      return { Authorization: `Bearer ${token}` };
    } catch (error) {
      // The installation was removed: forget it so the next lookup starts over.
      if (error.response && error.response.status === 404) {
        await redis.del(`install:${owner}/${repo}`);
      }
      console.error(`GitHub App token request failed for ${owner}/${repo}: ${error.message}`);
    }
  }

  const headers = {};
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
};

/**
 * Tier of the installation covering a repo, defaulting to free.
 */
const getInstallationTier = async (installationId) => {
  const data = await redis.hgetall(`installation:${installationId}`);
  return (data && data.tier) || 'free';
};

module.exports = {
  isAppConfigured,
  createAppJwt,
  getInstallationId,
  getInstallationToken,
  getInstallationTier,
  getGitHubHeaders,
  NOT_INSTALLED,
};
