const express = require('express');
const { generateRoadmapSVG, fetchIssues } = require('./roadmap');

const app = express();
const PORT = process.env.PORT || 5002;

app.get('/roadmap/:owner/:repo/:colorScheme?', async (req, res) => {
    const { owner, repo, colorScheme = 'dark' } = req.params;

    try {
        const issues = await fetchIssues(owner, repo);
        const svgContent = generateRoadmapSVG(issues, colorScheme);

        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svgContent);
    } catch (error) {
        res.status(500).send('Error fetching GitHub issues');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

