const crypto = require('crypto');
const redis = require('./redis');

const REGISTRATION_TTL = 86400; // 24 hours in seconds

const generateApiKey = () => {
  const bytes = crypto.randomBytes(16);
  return `rm_${bytes.toString('hex')}`;
};

const hashApiKey = (key) => {
  return crypto.createHash('sha256').update(key).digest('hex');
};

const storeApiKey = async (key, { owner, repo, email }, options = {}) => {
  const hash = hashApiKey(key);
  const fields = {
    owner,
    repo,
    tier: 'free',
    email,
    createdAt: new Date().toISOString(),
  };

  if (options.pending) {
    fields.emailConfirmed = 'false';
  }

  await redis.hset(`apikey:${hash}`, fields);
  // Also store a reverse lookup so we can check if a repo already has a key
  await redis.set(`repo-key:${owner}/${repo}`, hash);

  if (options.pending) {
    // Set 24hr TTL — if unconfirmed, both keys auto-delete
    await redis.expire(`apikey:${hash}`, REGISTRATION_TTL);
    await redis.expire(`repo-key:${owner}/${repo}`, REGISTRATION_TTL);
  }

  return hash;
};

const lookupApiKey = async (key) => {
  const hash = hashApiKey(key);
  const data = await redis.hgetall(`apikey:${hash}`);
  return data;
};

const keyExistsForRepo = async (owner, repo) => {
  const existing = await redis.get(`repo-key:${owner}/${repo}`);
  return !!existing;
};

const storeConfirmToken = async (token, keyHash, apiKey) => {
  await redis.set(`confirm:${token}`, { h: keyHash, k: apiKey }, { ex: REGISTRATION_TTL });
};

const lookupConfirmToken = async (token) => {
  const raw = await redis.get(`confirm:${token}`);
  if (!raw) return null;
  // Upstash auto-deserializes, so raw is already an object
  if (typeof raw === 'object' && raw.h) return raw;
  // Legacy format: plain keyHash string
  return { h: raw, k: null };
};

const confirmRegistration = async (token) => {
  // Look up the token
  const tokenData = await lookupConfirmToken(token);
  if (!tokenData) {
    return { success: false, reason: 'Invalid or expired confirmation token' };
  }

  const keyHash = tokenData.h;

  // Look up the key data
  const keyData = await redis.hgetall(`apikey:${keyHash}`);
  if (!keyData || !keyData.owner) {
    return { success: false, reason: 'Registration data not found (may have expired)' };
  }

  // Mark as confirmed
  await redis.hset(`apikey:${keyHash}`, { emailConfirmed: 'true' });

  // Remove TTLs so the keys persist forever
  await redis.persist(`apikey:${keyHash}`);
  await redis.persist(`repo-key:${keyData.owner}/${keyData.repo}`);

  // Delete the confirmation token (one-time use)
  await redis.del(`confirm:${token}`);

  return { success: true, owner: keyData.owner, repo: keyData.repo, key: tokenData.k };
};

module.exports = {
  generateApiKey,
  hashApiKey,
  storeApiKey,
  lookupApiKey,
  keyExistsForRepo,
  storeConfirmToken,
  lookupConfirmToken,
  confirmRegistration,
  REGISTRATION_TTL,
};
