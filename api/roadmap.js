const { generateRoadmapSVG, fetchIssues } = require('../roadmap');

module.exports = async (req, res) => {
  const { owner, repo, colorScheme = 'dark' } = req.query;

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