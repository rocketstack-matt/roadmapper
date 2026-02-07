const express = require('express');
const path = require('path');
const { generateRoadmapSVG, fetchIssues } = require('./roadmap');
const indexHandler = require('./api/index');

const app = express();
const PORT = process.env.PORT || 5002;

// Serve static files from public directory
app.use(express.static('public'));

// Landing page
app.get('/', async (req, res) => {
    await indexHandler(req, res);
});

// Roadmap generation handler
const handleRoadmap = async (req, res) => {
    const { owner, repo, colorScheme = 'dark' } = req.params;

    try {
        const issues = await fetchIssues(owner, repo);
        const svgContent = generateRoadmapSVG(issues, colorScheme);

        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svgContent);
    } catch (error) {
        res.status(500).send('Error fetching GitHub issues');
    }
};

// Roadmap generation route
app.get('/:owner/:repo/:colorScheme?', handleRoadmap);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Landing page: http://localhost:${PORT}/`);
    console.log(`Roadmap API: http://localhost:${PORT}/roadmap/{owner}/{repo}/{colorScheme}`);
});

