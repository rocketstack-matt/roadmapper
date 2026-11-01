const crypto = require('crypto');
const { ROADMAP_LABELS } = require('../roadmap');
const { invalidateIssues } = require('../lib/cache');
const { getCachedVerification } = require('../lib/verify');
const {
  getInstallationTier,
  forgetRepo,
  addInstallationRepos,
  removeInstallationRepos,
  deleteInstallation,
} = require('../lib/github-app');

// issues and label actions that can change what a roadmap shows
const ISSUE_ACTIONS = ['opened', 'edited', 'closed', 'reopened', 'labeled', 'unlabeled', 'deleted', 'transferred'];
const LABEL_ACTIONS = ['edited', 'deleted'];
// repository actions after which a repo must be re-verified (visibility,
// name or owner changed, or it's gone)
const REPOSITORY_ACTIONS = ['privatized', 'publicized', 'renamed', 'transferred', 'deleted'];

/**
 * Read the raw request body. Signatures are over the exact bytes GitHub sent,
 * so the body must not be parsed first. Vercel's helpers buffer the body and
 * replay it on the request stream; server.js mounts this route before any
 * body parser.
 */
const readRawBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

/**
 * Check X-Hub-Signature-256 (sha256=<hex HMAC of the body>) in constant time.
 */
const verifySignature = (secret, body, signature) => {
  if (typeof signature !== 'string' || !signature.startsWith('sha256=')) return false;
  const expected = Buffer.from(`sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`);
  const actual = Buffer.from(signature);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const splitFullName = (fullName) => {
  const [owner, repo] = fullName.split('/');
  return { owner, repo };
};

const isRoadmapLabel = (label) => !!label && ROADMAP_LABELS.includes(label.name);

// An issue is on a roadmap if it has a roadmap label, or just lost one.
const touchesRoadmap = (payload) =>
  (payload.issue && (payload.issue.labels || []).some(isRoadmapLabel)) || isRoadmapLabel(payload.label);

// Roadmap column and group labels (their names and colours are rendered).
const isRoadmapLabelName = (name) => typeof name === 'string' && name.startsWith('Roadmap');

// A repo is paid if its installation is, or its own verification is (an App
// install keeps the tier of a paid .roadmapper key).
const isPaid = async (installationTier, owner, repo) => {
  if (installationTier === 'paid') return true;
  const verification = await getCachedVerification(owner, repo);
  return !!verification && verification.tier === 'paid';
};

/**
 * Invalidate the cached issues of the repos that are webhook-driven: in an
 * installation and paid. Free repos keep their soft TTL.
 */
const invalidateIfPaid = async (payload, fullNames) => {
  if (!payload.installation) return 'ignored';
  const installationTier = await getInstallationTier(payload.installation.id);
  let result = 'ignored';
  for (const fullName of fullNames) {
    const { owner, repo } = splitFullName(fullName);
    if (await isPaid(installationTier, owner, repo)) {
      await invalidateIssues(owner, repo);
      result = 'invalidated';
    }
  }
  return result;
};

const handleInstallation = async (payload) => {
  const { action, installation } = payload;
  const repositories = payload.repositories || [];
  if (['created', 'unsuspend', 'new_permissions_accepted'].includes(action)) {
    await addInstallationRepos(installation, repositories);
    return 'updated';
  }
  if (action === 'deleted' || action === 'suspend') {
    await deleteInstallation(
      installation.id,
      repositories.map(r => r.full_name),
      { keepRecord: action === 'suspend' }
    );
    return 'updated';
  }
  return 'ignored';
};

const handleInstallationRepositories = async (payload) => {
  const { action, installation } = payload;
  if (action === 'added') {
    await addInstallationRepos(installation, payload.repositories_added || []);
    return 'updated';
  }
  if (action === 'removed') {
    await removeInstallationRepos(installation.id, (payload.repositories_removed || []).map(r => r.full_name));
    return 'updated';
  }
  return 'ignored';
};

const handleRepository = async (payload) => {
  if (!REPOSITORY_ACTIONS.includes(payload.action)) return 'ignored';
  const { repository, changes = {} } = payload;
  const fullNames = [repository.full_name];
  // Renames and transfers leave entries under the old name behind.
  if (changes.repository && changes.repository.name) {
    fullNames.push(`${repository.owner.login}/${changes.repository.name.from}`);
  }
  if (changes.owner && changes.owner.from) {
    const from = changes.owner.from.user || changes.owner.from.organization;
    if (from) fullNames.push(`${from.login}/${repository.name}`);
  }
  for (const fullName of fullNames) {
    const { owner, repo } = splitFullName(fullName);
    await forgetRepo(fullName);
    await invalidateIssues(owner, repo);
  }
  return 'updated';
};

const handleIssues = async (payload) => {
  if (!ISSUE_ACTIONS.includes(payload.action) || !touchesRoadmap(payload)) return 'ignored';
  const fullNames = [payload.repository.full_name];
  const newRepository = payload.changes && payload.changes.new_repository;
  if (newRepository) fullNames.push(newRepository.full_name);
  return invalidateIfPaid(payload, fullNames);
};

const handleLabel = async (payload) => {
  if (!LABEL_ACTIONS.includes(payload.action)) return 'ignored';
  const oldName = payload.changes && payload.changes.name && payload.changes.name.from;
  if (!isRoadmapLabelName(payload.label && payload.label.name) && !isRoadmapLabelName(oldName)) return 'ignored';
  return invalidateIfPaid(payload, [payload.repository.full_name]);
};

const EVENT_HANDLERS = {
  installation: handleInstallation,
  installation_repositories: handleInstallationRepositories,
  repository: handleRepository,
  issues: handleIssues,
  label: handleLabel,
};

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret) {
    res.status(503).json({ error: 'Webhooks are not configured' });
    return;
  }

  const body = await readRawBody(req);
  if (!verifySignature(secret, body, req.headers['x-hub-signature-256'])) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(body.toString('utf8'));
  } catch (e) {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const event = req.headers['x-github-event'];
  const handleEvent = EVENT_HANDLERS[event];
  try {
    const result = handleEvent ? await handleEvent(payload) : 'ignored';
    if (process.env.VERCEL_ENV !== 'production') {
      console.log(`[webhook] ${event}${payload.action ? `.${payload.action}` : ''} — ${result}`);
    }
    res.status(200).json({ result });
  } catch (error) {
    // A 5xx shows as a failed delivery, which can be redelivered from GitHub.
    console.error(`Webhook ${event} failed: ${error.message}`);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

module.exports = handler;
module.exports.verifySignature = verifySignature;
