/**
 * Redis key segment for a repo. GitHub owner and repo names are
 * case-insensitive, so the slug is lowercased: /Owner/Repo and /owner/repo
 * share one cache entry.
 */
const repoSlug = (owner, repo) => `${owner}/${repo}`.toLowerCase();

module.exports = { repoSlug };
