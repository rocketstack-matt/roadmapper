const { generateRoadmapSVG, fetchIssues } = require('../roadmap');

module.exports = async (req, res) => {
    const { owner, repo, colorScheme = 'dark' } = req.query;

    try {
        const issues = await fetchIssues(owner, repo);
        const svgContent = generateRoadmapSVG(issues, colorScheme);

        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svgContent);
    } catch (error) {
        res.status(500).send('Error fetching GitHub issues');
    }
};
