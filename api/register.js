const crypto = require('crypto');
const axios = require('axios');
const { withMiddleware } = require('../lib/middleware');
const { generateApiKey, storeApiKey, keyExistsForRepo, storeConfirmToken } = require('../lib/keys');
const { sendConfirmationEmail, isEmailConfigured } = require('../lib/email');

const handler = async (req, res) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Parse body (Express provides req.body when using express.json(), Vercel auto-parses)
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
  }

  const { owner, repo, email } = body || {};

  // Validate required fields
  if (!owner || !repo || !email) {
    res.status(400).json({ error: 'Missing required fields: owner, repo, email' });
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  // Check if a key already exists for this repo
  const exists = await keyExistsForRepo(owner, repo);
  if (exists) {
    res.status(409).json({ error: `A key already exists for ${owner}/${repo}` });
    return;
  }

  // Verify the GitHub repo exists
  try {
    const headers = {};
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      res.status(404).json({ error: `Repository ${owner}/${repo} not found on GitHub` });
      return;
    }
    res.status(500).json({ error: 'Failed to verify repository on GitHub' });
    return;
  }

  // Generate the key
  const key = generateApiKey();
  const needsConfirmation = isEmailConfigured();

  // Store key (pending if email confirmation needed)
  const keyHash = await storeApiKey(key, { owner, repo, email }, { pending: needsConfirmation });

  if (needsConfirmation) {
    // Generate confirmation token and store it
    const confirmToken = crypto.randomBytes(32).toString('hex');
    await storeConfirmToken(confirmToken, keyHash);

    // Build confirmation URL
    const host = req.headers.host || 'roadmapper.rocketstack.co';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const confirmUrl = `${protocol}://${host}/api/confirm?token=${confirmToken}`;

    // Send confirmation email
    try {
      await sendConfirmationEmail(email, confirmUrl, owner, repo);
    } catch (emailError) {
      res.status(500).json({ error: 'Failed to send confirmation email. Please try again.' });
      return;
    }

    res.status(201).json({
      key,
      owner,
      repo,
      tier: 'free',
      pendingConfirmation: true,
      message: 'Check your email to confirm your registration. Your key will activate after confirmation. The confirmation link expires in 24 hours.',
    });
  } else {
    res.status(201).json({
      key,
      owner,
      repo,
      tier: 'free',
      message: 'Save this key — it will not be shown again. Add it to a .roadmapper file in the root of your repository.',
    });
  }
};

module.exports = withMiddleware(handler, { ipRateLimitOnly: true });
