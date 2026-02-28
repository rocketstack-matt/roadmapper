const redis = require('./redis');

const getCachedIssues = async (owner, repo) => {
  const cached = await redis.get(`cache:issues:${owner}/${repo}`);
  if (!cached) return null;

  const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;

  // Backward compat: plain array (old format) → wrap as cache object
  if (Array.isArray(parsed)) {
    return { issues: parsed, etag: null, cachedAt: 0 };
  }

  return parsed;
};

const cacheIssues = async (owner, repo, issues, ttlSeconds, etag = null) => {
  const data = {
    issues,
    etag,
    cachedAt: Date.now(),
  };
  await redis.set(`cache:issues:${owner}/${repo}`, JSON.stringify(data));
};

const isCacheFresh = (cacheData, ttlSeconds) => {
  if (!cacheData || !cacheData.cachedAt) return false;
  const age = Date.now() - cacheData.cachedAt;
  return age < ttlSeconds * 1000;
};

module.exports = { getCachedIssues, cacheIssues, isCacheFresh };
