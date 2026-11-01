const redis = require('./redis');
const { repoSlug } = require('./repo-slug');

const cacheKey = (owner, repo) => `cache:issues:${repoSlug(owner, repo)}`;
const invalidatedKey = (owner, repo) => `cache:invalidated:${repoSlug(owner, repo)}`;

// How long an invalidation marker is kept: longer than any soft TTL, so a
// fetch that started before the invalidation can't be mistaken for a fresh one.
const INVALIDATION_MARKER_TTL = 86400;

const getCachedIssues = async (owner, repo) => {
  const cached = await redis.get(cacheKey(owner, repo));
  if (!cached) return null;

  const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;

  // Backward compat: plain array (old format) → wrap as cache object
  if (Array.isArray(parsed)) {
    return { issues: parsed, etag: null, cachedAt: 0 };
  }

  return parsed;
};

/**
 * Cache a repo's issues. fetchedAt is when the GitHub fetch started; if the
 * cache was invalidated (by a webhook) since then, the issues may predate the
 * change, so they are stored already stale and the next request re-fetches.
 */
const cacheIssues = async (owner, repo, issues, ttlSeconds, etag = null, fetchedAt = Date.now()) => {
  const invalidatedAt = Number(await redis.get(invalidatedKey(owner, repo))) || 0;
  const data = {
    issues,
    etag,
    cachedAt: invalidatedAt >= fetchedAt ? 0 : fetchedAt,
  };
  await redis.set(cacheKey(owner, repo), JSON.stringify(data));
};

/**
 * Mark a repo's cached issues stale so the next request re-fetches them.
 */
const invalidateIssues = async (owner, repo) => {
  await redis.set(invalidatedKey(owner, repo), String(Date.now()), { ex: INVALIDATION_MARKER_TTL });
  await redis.del(cacheKey(owner, repo));
};

const isCacheFresh = (cacheData, ttlSeconds) => {
  if (!cacheData || !cacheData.cachedAt) return false;
  const age = Date.now() - cacheData.cachedAt;
  return age < ttlSeconds * 1000;
};

module.exports = { getCachedIssues, cacheIssues, invalidateIssues, isCacheFresh };
