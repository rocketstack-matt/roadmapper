require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const path = require('path');
const indexHandler = require('./api/index');
const roadmapHandler = require('./api/roadmap');
const viewHandler = require('./api/view');
const embedHandler = require('./api/embed');
const htmlHandler = require('./api/html');
const registerHandler = require('./api/register');
const confirmHandler = require('./api/confirm');
const webhookHandler = require('./api/github/webhook');
const setupHandler = require('./api/github/setup');

const app = express();
const PORT = process.env.PORT || 5002;

// Parse JSON bodies for registration endpoint
app.use(express.json());

// Serve static files from public directory
app.use(express.static('public'));

// Landing page
app.get('/', async (req, res) => {
    await indexHandler(req, res);
});

// Registration endpoint
app.post('/api/register', async (req, res) => {
    await registerHandler(req, res);
});

// Email confirmation endpoint
app.get('/api/confirm', async (req, res) => {
    await confirmHandler(req, res);
});

// GitHub App webhook endpoint
app.post('/api/github/webhook', async (req, res) => {
    await webhookHandler(req, res);
});

// GitHub App post-installation redirect
app.get('/api/github/setup', async (req, res) => {
    await setupHandler(req, res);
});

// View page handler
app.get('/view/:owner/:repo/:bgColor/:textColor', async (req, res) => {
    await viewHandler(req, res);
});

// View page fallback (redirect to default colors)
app.get('/view/:owner/:repo', (req, res) => {
    const { owner, repo } = req.params;
    res.redirect(`/view/${owner}/${repo}/ffffff/24292f`);
});

// Embed page handler
app.get('/embed/:owner/:repo/:bgColor/:textColor', async (req, res) => {
    await embedHandler(req, res);
});

// Embed page fallback (redirect to default colors)
app.get('/embed/:owner/:repo', (req, res) => {
    const { owner, repo } = req.params;
    res.redirect(`/embed/${owner}/${repo}/ffffff/24292f`);
});

// HTML generator handler
app.get('/html/:owner/:repo/:bgColor/:textColor', async (req, res) => {
    await htmlHandler(req, res);
});

// HTML generator fallback (redirect to default colors)
app.get('/html/:owner/:repo', (req, res) => {
    const { owner, repo } = req.params;
    res.redirect(`/html/${owner}/${repo}/ffffff/24292f`);
});

// Roadmap SVG handler (uses same middleware-wrapped handler as serverless)
app.get('/:owner/:repo/:bgColor/:textColor', async (req, res) => {
    await roadmapHandler(req, res);
});

// Fallback route for /:owner/:repo (redirects to default colors)
app.get('/:owner/:repo', (req, res) => {
    const { owner, repo } = req.params;
    res.redirect(`/${owner}/${repo}/ffffff/24292f`);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Landing page: http://localhost:${PORT}/`);
    console.log(`Roadmap API: http://localhost:${PORT}/{owner}/{repo}/{bgColor}/{textColor}`);
    console.log(`Example: http://localhost:${PORT}/rocketstack-matt/roadmapper/ffffff/24292f`);
});
