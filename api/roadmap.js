const { generateRoadmapSVG, fetchIssues } = require('../roadmap');
const { withMiddleware } = require('../lib/middleware');
const { trackEvent } = require('../lib/analytics');

const handler = async (req, res) => {
  // Extract the path from the URL
  const url = req.url;

  // Try to match 4-parameter format first
  let match = url.match(/^\/([^/?]+)\/([^/?]+)\/([^/?]+)\/([^/?]+)\/?/);

  // If no match, check for 2-parameter format and redirect to defaults
  if (!match) {
    const fallbackMatch = url.match(/^\/([^/?]+)\/([^/?]+)\/?$/);
    if (fallbackMatch) {
      const owner = fallbackMatch[1];
      const repo = fallbackMatch[2];
      return res.redirect(301, `/${owner}/${repo}/ffffff/24292f`);
    }
    return res.status(400).send('Invalid URL format. Expected: /:owner/:repo/:bgColor/:textColor');
  }

  const owner = match[1];
  const repo = match[2];
  const bgColor = match[3];
  const textColor = match[4];

  if (!owner || !repo) {
    return res.status(400).send('Missing owner or repo parameter');
  }

  try {
    const issues = await fetchIssues(owner, repo, req.cacheTtl);
    const svgContent = generateRoadmapSVG(issues, bgColor, textColor);

    trackEvent('roadmap_view', {
      client_id: (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim(),
      owner,
      repo
    });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svgContent);
  } catch (error) {
    res.status(500).send('Error fetching GitHub issues');
  }
};

module.exports = withMiddleware(handler);
