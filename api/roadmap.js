const { generateRoadmapSVG, fetchIssues } = require('../roadmap');

module.exports = async (req, res) => {
  // Extract the path from the URL
  const url = req.url;
  const match = url.match(/\/api\/roadmap\/([^/]+)\/([^/]+)\/?([^/]*)/);

  if (!match) {
    return res.status(400).send('Invalid URL format');
  }

  const owner = match[1];
  const repo = match[2];
  const colorScheme = match[3] || 'dark';

  if (!owner || !repo) {
    return res.status(400).send('Missing owner or repo parameter');
  }

  try {
    const issues = await fetchIssues(owner, repo);
    const svgContent = generateRoadmapSVG(issues, colorScheme);

    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svgContent);
  } catch (error) {
    res.status(500).send('Error fetching GitHub issues');
  }
};