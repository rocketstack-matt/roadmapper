const crypto = require('crypto');
const axios = require('axios');
const redis = require('./redis');
const { VERIFICATION_TTL } = require('./tiers');
const { repoSlug } = require('./repo-slug');

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

// Visibility of an installed repo is re-checked this often, so a repo made
// private stops being served within a minute.
const VISIBILITY_TTL = 60;

// Installation tokens only ever need to read issues and the .roadmapper file.
const TOKEN_PERMISSIONS = { issues: 'read', contents: 'read', metadata: 'read' };

// Tokens are kept in this process's memory only, never in Redis, keyed by
// installation and repo (each token is scoped to one repo).
const tokenCache = new Map();

/**
 * Thrown instead of returning installation headers for a private repo.
 * Roadmaps are public URLs, and paid private access isn't built yet.
 */
class PrivateRepoError extends Error {
  constructor(owner, repo) {
    super(`${owner}/${repo} is a private repository`);
    this.name = 'PrivateRepoError';
  }
}

/**
 * Thrown when a repo's installation can't be used (uninstalled, or the token
 * request failed). Callers must not fall back to GITHUB_TOKEN: the repo may
 * have been verified by the installation alone, with no .roadmapper opt-in.
 */
class AppAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AppAuthError';
  }
}

// Check at runtime (not module load time, for testability)
const isAppConfigured = () => !!(
  (process.env.GITHUB_APP_ID || '').trim() && (process.env.GITHUB_APP_PRIVATE_KEY || '').trim()
);

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
  const fullName = repoSlug(owner, repo);
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

  const cacheKey = `install:${repoSlug(owner, repo)}`;
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
 * Return an installation access token scoped to one repo and to read-only
 * TOKEN_PERMISSIONS, minting one via POST /app/installations/{id}/access_tokens
 * when none is held in memory.
 */
const getInstallationToken = async (installationId, owner, repo) => {
  const cacheKey = `${installationId}:${repoSlug(owner, repo)}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.refreshAt > Date.now()) return cached.token;

  const response = await axios.post(
    `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
    { repositories: [repo], permissions: TOKEN_PERMISSIONS },
    { headers: appHeaders() }
  );
  const { token, expires_at: expiresAt } = response.data;
  tokenCache.set(cacheKey, {
    token,
    refreshAt: new Date(expiresAt).getTime() - TOKEN_REFRESH_MARGIN * 1000,
  });
  return token;
};

const clearTokenCache = () => tokenCache.clear();

/**
 * Whether a repo is private, read with its installation headers and cached
 * for VISIBILITY_TTL. Anything but an explicit `private: false` counts as
 * private, so an unexpected response never exposes a repo.
 */
const isRepoPrivate = async (owner, repo, headers) => {
  const cacheKey = `visibility:${repoSlug(owner, repo)}`;
  const cached = await redis.get(cacheKey);
  if (cached === 'public') return false;
  if (cached === 'private') return true;

  const response = await axios.get(`${GITHUB_API}/repos/${owner}/${repo}`, { headers });
  const isPrivate = !(response.data && response.data.private === false);
  await redis.set(cacheKey, isPrivate ? 'private' : 'public', { ex: VISIBILITY_TTL });
  return isPrivate;
};

/**
 * GitHub auth headers for reading a repo: an installation token when the App
 * is installed on it, otherwise the shared GITHUB_TOKEN (or none).
 *
 * For an installed repo this never falls back to GITHUB_TOKEN. It throws
 * PrivateRepoError for a private repo, and AppAuthError when the installation
 * can't be used; that also forgets the cached installation, so the next
 * lookup notices an uninstall.
 */
const getGitHubHeaders = async (owner, repo) => {
  const installationId = await getInstallationId(owner, repo);
  if (installationId) {
    let headers;
    let isPrivate;
    try {
      headers = { Authorization: `Bearer ${await getInstallationToken(installationId, owner, repo)}` };
      isPrivate = await isRepoPrivate(owner, repo, headers);
    } catch (error) {
      tokenCache.delete(`${installationId}:${repoSlug(owner, repo)}`);
      await redis.del(`install:${repoSlug(owner, repo)}`);
      throw new AppAuthError(`GitHub App access failed for ${owner}/${repo}: ${error.message}`);
    }
    if (isPrivate) throw new PrivateRepoError(owner, repo);
    return headers;
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
  isRepoPrivate,
  clearTokenCache,
  PrivateRepoError,
  AppAuthError,
  NOT_INSTALLED,
};
