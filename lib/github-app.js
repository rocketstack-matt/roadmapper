const crypto = require('crypto');
const axios = require('axios');
const redis = require('./redis');
const { TIERS, VERIFICATION_TTL } = require('./tiers');
const { repoSlug } = require('./repo-slug');
const { getMarketplaceTier, higherTier } = require('./marketplace');

const GITHUB_API = 'https://api.github.com';

// Installation tokens live for an hour; refresh this long before they expire
// so a token handed out is never about to lapse mid-request.
const TOKEN_REFRESH_MARGIN = 5 * 60;

// Marker cached for repos without the App, so the installation lookup isn't
// repeated on every request. Short, so a fresh install is picked up quickly.
const NOT_INSTALLED = 'none';
const NOT_INSTALLED_TTL = 10 * 60;

// Repo → installation mappings expire so the lazy lookup notices a repo being
// removed from an installation, even if the webhook saying so was missed.
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

// Webhooks only arrive (and are only accepted) once their secret is set.
const isWebhookConfigured = () => isAppConfigured() && !!process.env.GITHUB_APP_WEBHOOK_SECRET;

/**
 * URL that installs the App, from its slug (the last part of
 * https://github.com/apps/<slug>), or null when the App or slug isn't set up.
 */
const getAppInstallUrl = () => {
  const slug = (process.env.GITHUB_APP_SLUG || '').trim();
  if (!isAppConfigured() || !slug) return null;
  return `https://github.com/apps/${encodeURIComponent(slug)}/installations/new`;
};

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

const parseRepos = (existing) => {
  try {
    return Array.isArray(existing.repos) ? existing.repos : JSON.parse(existing.repos || '[]');
  } catch (e) {
    return [];
  }
};

/**
 * Link an installation to its account's GitHub id, both ways: accountId on
 * installation:{id} (how getInstallationTier() finds the account's
 * Marketplace plan) and a field on account-installations:{account id} (how a
 * purchase finds every installation to re-verify). One field per
 * installation, so concurrent webhooks can't drop each other's ids.
 */
const linkInstallationAccount = async (installationId, accountId) => {
  if (!accountId) return;
  const id = String(installationId);
  await redis.hset(`installation:${id}`, { accountId: String(accountId) });
  await redis.hset(`account-installations:${accountId}`, { [id]: '1' });
};

/**
 * Record an installation's account, repos and tier. The tier is left alone if
 * already set, so a paid installation isn't reset by a later lookup.
 */
const recordInstallation = async (installation, owner, repo) => {
  const key = `installation:${installation.id}`;
  const existing = (await redis.hgetall(key)) || {};
  const repos = parseRepos(existing);
  const fullName = repoSlug(owner, repo);
  if (!repos.includes(fullName)) repos.push(fullName);

  await redis.hset(key, {
    account: installation.account ? installation.account.login : owner,
    repos: JSON.stringify(repos),
    tier: existing.tier || 'free',
  });
  await linkInstallationAccount(installation.id, installation.account && installation.account.id);
};

/**
 * Forget everything cached about how a repo (an "owner/repo" full name) is
 * authenticated, verified and seen, so the next request looks it up again
 * from scratch — through the private-repo check.
 */
const forgetRepo = async (fullName) => {
  const slug = fullName.toLowerCase();
  await redis.del(`install:${slug}`);
  await redis.del(`visibility:${slug}`);
  await redis.del(`repo:${slug}`);
  await redis.del(`repo-ttl:${slug}`);
};

// Drop this process's tokens for an installation. Other instances keep theirs
// until they expire, but GitHub rejects them once the App is gone.
const forgetInstallationTokens = (installationId) => {
  for (const key of tokenCache.keys()) {
    if (key.startsWith(`${installationId}:`)) tokenCache.delete(key);
  }
};

/**
 * Map repos (GitHub webhook repository objects) to an installation, as the
 * installation and installation_repositories webhooks report them. Private
 * repos are not mapped: their roadmaps must not be served publicly. Each
 * repo's verification is cleared so it is re-verified as installed.
 */
const addInstallationRepos = async (installation, repositories) => {
  const id = String(installation.id);
  await linkInstallationAccount(id, installation.account && installation.account.id);
  for (const repository of repositories) {
    await forgetRepo(repository.full_name);
    if (repository.private) continue;
    const [owner, repo] = repository.full_name.split('/');
    await redis.set(`install:${repoSlug(owner, repo)}`, id, { ex: INSTALLATION_TTL });
    await recordInstallation(installation, owner, repo);
  }
};

/**
 * Unmap repos removed from an installation.
 */
const removeInstallationRepos = async (installationId, fullNames) => {
  const key = `installation:${installationId}`;
  for (const fullName of fullNames) {
    await forgetRepo(fullName);
  }
  const removed = fullNames.map(name => name.toLowerCase());
  const existing = await redis.hgetall(key);
  if (existing) {
    const repos = parseRepos(existing).filter(name => !removed.includes(name.toLowerCase()));
    await redis.hset(key, { repos: JSON.stringify(repos) });
  }
};

/**
 * Forget an installation (uninstalled or suspended): every repo it covered,
 * its tokens and, unless keepRecord (a suspension keeps its id and tier), its
 * record. fullNames adds repos the webhook listed that the record may not
 * know about yet.
 */
const deleteInstallation = async (installationId, fullNames = [], { keepRecord = false } = {}) => {
  const key = `installation:${installationId}`;
  const existing = (await redis.hgetall(key)) || {};
  const repos = new Set([...parseRepos(existing), ...fullNames]);
  for (const fullName of repos) {
    await forgetRepo(fullName);
  }
  forgetInstallationTokens(installationId);
  if (keepRecord) {
    await redis.hset(key, { repos: '[]' });
  } else {
    await redis.del(key);
  }
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
 * The one place an installation's tier is decided; every tier check for an
 * installed repo goes through here. Installs start on free. The tier is the
 * higher of the account's GitHub Marketplace plan (lib/marketplace.js) and
 * the manual tier setInstallationTier() (scripts/set-tier.js) recorded, so a
 * hand-set paid tier (a direct deal) holds whatever the Marketplace says, and
 * a manual free never cancels a Marketplace purchase.
 */
const getInstallationTier = async (installationId) => {
  const data = await redis.hgetall(`installation:${installationId}`);
  const manualTier = (data && TIERS[data.tier]) ? data.tier : 'free';
  return higherTier(manualTier, await getMarketplaceTier(data && data.accountId));
};

/**
 * Clear the cached verification of every repo an installation covers, so its
 * tier is re-read on their next request. Returns those repos.
 */
const clearInstallationVerifications = async (installationId) => {
  const repos = parseRepos((await redis.hgetall(`installation:${installationId}`)) || {});
  for (const fullName of repos) {
    const slug = repoSlug(...fullName.split('/'));
    await redis.del(`repo:${slug}`);
    await redis.del(`repo-ttl:${slug}`);
  }
  return repos;
};

/**
 * Set an installation's manual tier and clear the cached verification of
 * every repo it covers, so the new tier applies on their next request.
 * Returns those repos.
 */
const setInstallationTier = async (installationId, tier) => {
  if (!TIERS[tier]) throw new Error(`Invalid tier "${tier}"`);
  await redis.hset(`installation:${installationId}`, { tier });
  return clearInstallationVerifications(installationId);
};

/**
 * Every installation of an account (a Marketplace purchase's account:
 * { id, login, type }): those already linked to it, plus the one GitHub
 * reports for it (GET /orgs/{org}/installation or /users/{user}/installation)
 * when the App is configured, which links installations recorded before
 * accounts were. A failed lookup only logs: a purchase can come before the
 * install, which links itself when it's seen.
 */
const getAccountInstallations = async (account) => {
  if (isAppConfigured() && account.login) {
    const path = account.type === 'Organization' ? 'orgs' : 'users';
    try {
      const response = await axios.get(
        `${GITHUB_API}/${path}/${encodeURIComponent(account.login)}/installation`,
        { headers: appHeaders() }
      );
      await linkInstallationAccount(response.data.id, account.id);
    } catch (error) {
      if (!(error.response && error.response.status === 404)) {
        console.error(`GitHub App installation lookup failed for ${account.login}: ${error.message}`);
      }
    }
  }
  return Object.keys((await redis.hgetall(`account-installations:${account.id}`)) || {});
};

const REPOS_PER_PAGE = 100;

/**
 * An installation's account and the repos it covers, for the post-install
 * setup page: { account, repositories: [{ owner, repo, private }] }, or null
 * if there is no such installation. Reads with a one-off, metadata-only token
 * that isn't kept.
 */
const getInstallationRepos = async (installationId) => {
  let installation;
  try {
    installation = (await axios.get(`${GITHUB_API}/app/installations/${installationId}`, { headers: appHeaders() })).data;
  } catch (error) {
    if (error.response && error.response.status === 404) return null;
    throw error;
  }

  const { data } = await axios.post(
    `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
    { permissions: { metadata: 'read' } },
    { headers: appHeaders() }
  );
  const headers = { Authorization: `Bearer ${data.token}`, Accept: 'application/vnd.github+json' };

  const repositories = [];
  for (let page = 1; ; page++) {
    const response = await axios.get(
      `${GITHUB_API}/installation/repositories?per_page=${REPOS_PER_PAGE}&page=${page}`,
      { headers }
    );
    const batch = response.data.repositories || [];
    for (const repository of batch) {
      const [owner, repo] = repository.full_name.split('/');
      // Anything but an explicit private: false counts as private, as in isRepoPrivate()
      repositories.push({ owner, repo, private: repository.private !== false });
    }
    if (batch.length < REPOS_PER_PAGE) break;
  }

  return { account: installation.account ? installation.account.login : null, repositories };
};

module.exports = {
  isAppConfigured,
  isWebhookConfigured,
  createAppJwt,
  getInstallationId,
  getInstallationToken,
  getInstallationTier,
  setInstallationTier,
  clearInstallationVerifications,
  getAccountInstallations,
  linkInstallationAccount,
  getInstallationRepos,
  getAppInstallUrl,
  getGitHubHeaders,
  isRepoPrivate,
  clearTokenCache,
  PrivateRepoError,
  AppAuthError,
  forgetRepo,
  addInstallationRepos,
  removeInstallationRepos,
  deleteInstallation,
  NOT_INSTALLED,
};
