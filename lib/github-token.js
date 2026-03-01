const { isGitHubAppConfigured, getTokenForRepo } = require('./github-app');

/**
 * Resolve the best available GitHub token for a given repo.
 *
 * Priority:
 *   1. GitHub App installation token (per-repo, 5000 req/hr each)
 *   2. Shared PAT via GITHUB_TOKEN env var (5000 req/hr shared)
 *   3. Unauthenticated (60 req/hr)
 *
 * Returns { token, source } where source is 'app', 'pat', or 'none'.
 */
const resolveGitHubToken = async (owner, repo) => {
  // 1. Try GitHub App installation token
  if (isGitHubAppConfigured()) {
    const token = await getTokenForRepo(owner, repo);
    if (token) return { token, source: 'app' };
  }

  // 2. Fall back to shared PAT
  if (process.env.GITHUB_TOKEN) {
    return { token: process.env.GITHUB_TOKEN, source: 'pat' };
  }

  // 3. Unauthenticated
  return { token: null, source: 'none' };
};

module.exports = { resolveGitHubToken };
