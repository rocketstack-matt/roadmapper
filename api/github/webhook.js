const crypto = require('crypto');
const redis = require('../../lib/redis');

/**
 * Verify the webhook signature from GitHub.
 * Uses HMAC-SHA256 with the GITHUB_APP_WEBHOOK_SECRET.
 */
const verifySignature = (payload, signature) => {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
};

/**
 * Store installation ID for repos in Redis.
 */
const storeInstallation = async (installationId, repos) => {
  for (const repo of repos) {
    const owner = repo.full_name.split('/')[0];
    const repoName = repo.full_name.split('/')[1];
    await redis.set(`gh-app:installation:${owner}/${repoName}`, String(installationId));
  }
};

/**
 * Remove installation data for repos from Redis.
 */
const removeInstallation = async (installationId, repos) => {
  for (const repo of repos) {
    const owner = repo.full_name.split('/')[0];
    const repoName = repo.full_name.split('/')[1];
    await redis.del(`gh-app:installation:${owner}/${repoName}`);
  }
  // Also clean up the token cache
  await redis.del(`gh-app:token:${installationId}`);
};

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get the raw body for signature verification
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const signature = req.headers['x-hub-signature-256'];

  if (!verifySignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.headers['x-github-event'];
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const action = body.action;
  const installationId = body.installation?.id;

  if (event === 'installation') {
    if (action === 'created' && body.repositories) {
      await storeInstallation(installationId, body.repositories);
    } else if (action === 'deleted' && body.repositories) {
      await removeInstallation(installationId, body.repositories);
    }
  } else if (event === 'installation_repositories') {
    if (action === 'added' && body.repositories_added) {
      await storeInstallation(installationId, body.repositories_added);
    } else if (action === 'removed' && body.repositories_removed) {
      await removeInstallation(installationId, body.repositories_removed);
    }
  }

  return res.status(200).json({ ok: true });
};

module.exports = handler;
module.exports.verifySignature = verifySignature;
module.exports.storeInstallation = storeInstallation;
module.exports.removeInstallation = removeInstallation;
