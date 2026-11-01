const redis = require('./redis');
const { TIERS } = require('./tiers');

// marketplace_purchase actions. Only these three change what an account has
// now; the pending ones announce a downgrade or cancellation that takes
// effect at the end of the billing cycle, when GitHub sends changed or
// cancelled.
const CURRENT_ACTIONS = ['purchased', 'changed', 'cancelled'];
const PENDING_ACTIONS = ['pending_change', 'pending_change_cancelled'];

const TIER_RANK = { free: 0, paid: 1 };

const higherTier = (a, b) => ((TIER_RANK[b] || 0) > (TIER_RANK[a] || 0) ? b : a);

/**
 * The Marketplace plan → tier mapping, from GITHUB_MARKETPLACE_PLANS: a JSON
 * object keyed by plan id or exact plan name, e.g. {"12345":"paid"}. Plan ids
 * and names come from the Marketplace listing, so they're configuration.
 * Unset or invalid JSON maps every plan to free.
 */
const getPlanTiers = () => {
  const raw = (process.env.GITHUB_MARKETPLACE_PLANS || '').trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (e) {
    console.error(`GITHUB_MARKETPLACE_PLANS is not valid JSON: ${e.message}`);
    return {};
  }
};

const isMarketplaceConfigured = () => Object.keys(getPlanTiers()).length > 0;

/**
 * A plan's tier: by id, else by name. An unknown plan (or none) is free, so a
 * new or misconfigured plan never grants paid access.
 */
const planTier = (planId, planName) => {
  if (!planId && !planName) return 'free';
  const tiers = getPlanTiers();
  const byId = planId ? tiers[String(planId)] : undefined;
  const tier = byId !== undefined ? byId : tiers[planName];
  return TIERS[tier] ? tier : 'free';
};

/**
 * The tier an account (a GitHub user or organization id) has bought on the
 * Marketplace. Decided from the stored plan and the current mapping, so a
 * change to GITHUB_MARKETPLACE_PLANS applies without new purchase events.
 */
const getMarketplaceTier = async (accountId) => {
  if (!accountId) return 'free';
  const data = await redis.hgetall(`marketplace:${accountId}`);
  return data ? planTier(data.planId, data.planName) : 'free';
};

// Records a purchase event on marketplace:{account id} (KEYS[1]) unless it is
// older than the plan already recorded. One script, so the effective_date
// check and the write are atomic: two deliveries handled at once can't both
// pass the check and leave the older one written last.
// ARGV: kind ('current' | 'pending' | 'pending_cancelled'), effectiveAt (ms),
// account login, plan id, plan name, onFreeTrial. Returns 1 when the current
// plan was written, else 0.
const APPLY_PURCHASE_SCRIPT = `
local at = tonumber(ARGV[2])
local recorded = tonumber(redis.call('HGET', KEYS[1], 'effectiveAt')) or 0
if at < recorded then return 0 end
if ARGV[1] == 'pending_cancelled' then
  redis.call('HSET', KEYS[1], 'account', ARGV[3], 'pendingPlanId', '', 'pendingPlanName', '', 'pendingAt', '')
  return 0
end
if ARGV[1] == 'pending' then
  redis.call('HSET', KEYS[1], 'account', ARGV[3], 'pendingPlanId', ARGV[4], 'pendingPlanName', ARGV[5], 'pendingAt', ARGV[2])
  return 0
end
local pendingAt = tonumber(redis.call('HGET', KEYS[1], 'pendingAt'))
redis.call('HSET', KEYS[1], 'account', ARGV[3], 'planId', ARGV[4], 'planName', ARGV[5], 'onFreeTrial', ARGV[6], 'effectiveAt', ARGV[2])
if not pendingAt or pendingAt <= at then
  redis.call('HSET', KEYS[1], 'pendingPlanId', '', 'pendingPlanName', '', 'pendingAt', '')
end
return 1
`;

/**
 * Apply a marketplace_purchase webhook to marketplace:{account id}. Returns
 * the account ({ id, login }) and whether its current plan changed, or null
 * for a payload that isn't a purchase event.
 *
 * Events are ordered by effective_date: one older than the plan already
 * recorded is ignored, so a late or redelivered event can't undo a newer
 * change (a stale "purchased" can't re-grant a cancelled plan). Re-applying
 * the same event is a no-op. Pending events are a record of what GitHub
 * announced; they never set the tier, which only changes when changed or
 * cancelled arrives (and clears the pending change it carries out).
 */
const applyPurchaseEvent = async (payload) => {
  const { action } = payload;
  const purchase = payload.marketplace_purchase;
  if (![...CURRENT_ACTIONS, ...PENDING_ACTIONS].includes(action)) return null;
  if (!purchase || !purchase.account || !purchase.account.id) return null;

  const account = { id: String(purchase.account.id), login: purchase.account.login, type: purchase.account.type };
  // An undated event sorts before any dated one, so it can't override one.
  const effectiveAt = Date.parse(payload.effective_date) || 0;
  const plan = purchase.plan || {};
  const cancelled = action === 'cancelled';
  const kind = { pending_change: 'pending', pending_change_cancelled: 'pending_cancelled' }[action] || 'current';

  const written = await redis.eval(APPLY_PURCHASE_SCRIPT, [`marketplace:${account.id}`], [
    kind,
    String(effectiveAt),
    account.login || '',
    cancelled ? '' : String(plan.id || ''),
    cancelled ? '' : (plan.name || ''),
    !cancelled && purchase.on_free_trial ? 'true' : 'false',
  ]);
  return { account, changed: Number(written) === 1 };
};

/**
 * The Marketplace listing (github.com/marketplace/<App slug>), once plans are
 * mapped, or null.
 */
const getMarketplaceUrl = () => {
  const slug = (process.env.GITHUB_APP_SLUG || '').trim();
  if (!slug || !isMarketplaceConfigured()) return null;
  return `https://github.com/marketplace/${encodeURIComponent(slug)}`;
};

module.exports = {
  higherTier,
  planTier,
  getPlanTiers,
  isMarketplaceConfigured,
  getMarketplaceTier,
  applyPurchaseEvent,
  getMarketplaceUrl,
};
