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

/**
 * Apply a marketplace_purchase webhook to marketplace:{account id}. Returns
 * the account ({ id, login }) and whether its current plan changed, or null
 * for a payload that isn't a purchase event.
 *
 * Events are ordered by effective_date: one older than the plan already
 * recorded is ignored, so a late or redelivered event can't undo a newer
 * change (a stale "purchased" can't re-grant a cancelled plan). Re-applying
 * the same event is a no-op.
 */
const applyPurchaseEvent = async (payload) => {
  const { action } = payload;
  const purchase = payload.marketplace_purchase;
  if (![...CURRENT_ACTIONS, ...PENDING_ACTIONS].includes(action)) return null;
  if (!purchase || !purchase.account || !purchase.account.id) return null;

  const account = { id: String(purchase.account.id), login: purchase.account.login, type: purchase.account.type };
  const key = `marketplace:${account.id}`;
  const existing = (await redis.hgetall(key)) || {};
  const effectiveAt = Date.parse(payload.effective_date) || Date.now();
  const recordedAt = Number(existing.effectiveAt) || 0;
  const plan = purchase.plan || {};

  if (action === 'pending_change_cancelled') {
    await redis.hset(key, { account: account.login, pendingPlanId: '', pendingPlanName: '', pendingAt: '' });
    return { account, changed: false };
  }

  if (effectiveAt < recordedAt) return { account, changed: false };

  if (action === 'pending_change') {
    await redis.hset(key, {
      account: account.login,
      pendingPlanId: String(plan.id || ''),
      pendingPlanName: plan.name || '',
      pendingAt: String(effectiveAt),
    });
    return { account, changed: false };
  }

  const cancelled = action === 'cancelled';
  const fields = {
    account: account.login,
    planId: cancelled ? '' : String(plan.id || ''),
    planName: cancelled ? '' : (plan.name || ''),
    onFreeTrial: !cancelled && purchase.on_free_trial ? 'true' : 'false',
    effectiveAt: String(effectiveAt),
  };
  // The change a pending event announced has now happened.
  if (!existing.pendingAt || Number(existing.pendingAt) <= effectiveAt) {
    Object.assign(fields, { pendingPlanId: '', pendingPlanName: '', pendingAt: '' });
  }
  await redis.hset(key, fields);
  return { account, changed: true };
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
