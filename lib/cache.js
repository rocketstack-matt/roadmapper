const redis = require('./redis');

const getCachedIssues = async (owner, repo) => {
  const cached = await redis.get(`cache:issues:${owner}/${repo}`);
  if (cached) {
    return typeof cached === 'string' ? JSON.parse(cached) : cached;
  }
  return null;
};

const cacheIssues = async (owner, repo, issues, ttlSeconds) => {
  if (ttlSeconds && ttlSeconds > 0) {
    await redis.set(`cache:issues:${owner}/${repo}`, JSON.stringify(issues), { ex: ttlSeconds });
  }
};

module.exports = { getCachedIssues, cacheIssues };
