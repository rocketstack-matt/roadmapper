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

// Events at the same effective_date apply in this order, so a redelivered
// purchased can't re-grant a cancellation dated the same moment: the higher
// rank wins, then the higher delivery id (X-GitHub-Delivery). A plan read
// from GitHub's Marketplace API (reconcileAccount()) ranks lowest, so any
// webhook dated the same wins over it. Pending events rank between purchased
// and changed: a changed or cancelled dated the same carries the pending
// change out.
const EVENT_RANK = {
  reconciled: 0,
  purchased: 1,
  pending_change: 2,
  pending_change_cancelled: 2,
  changed: 3,
  cancelled: 4,
};
const MAX_EVENT_RANK = Math.max(...Object.values(EVENT_RANK));

// Records a purchase event on marketplace:{account id} (KEYS[1]) unless it
// orders before the event that set the plan already recorded, by
// (effectiveAt, rank, delivery id) — compared in full, so re-applying the
// same event is a no-op. One script, so the check and the write are atomic:
// two deliveries handled at once can't both pass the check and leave the
// older one written last. Pending events are checked against the current
// plan's event (not each other: they never set the tier). A record written
// before ranks existed (#46) has effectiveAt but no eventRank: a cancellation
// (no plan) ranks as cancelled, and a plan, whose purchased or changed can't
// be told apart, as the highest rank, so an event dated the same can't
// override either.
// ARGV: kind ('current' | 'pending' | 'pending_cancelled'), effectiveAt (ms),
// account login, plan id, plan name, onFreeTrial, rank, delivery id. Returns
// 1 when the current plan was written, 2 when the event is the one that set
// it (a replay: nothing is written), else 0.
const APPLY_PURCHASE_SCRIPT = `
local function order(at, rank, id, otherAt, otherRank, otherId)
  if at ~= otherAt then return at > otherAt and 1 or -1 end
  if rank ~= otherRank then return rank > otherRank and 1 or -1 end
  if id ~= otherId then return id > otherId and 1 or -1 end
  return 0
end
local at = tonumber(ARGV[2])
local rank = tonumber(ARGV[7])
local id = ARGV[8]
-- No recorded plan orders before every event, even an undated one
local recordedAt = tonumber(redis.call('HGET', KEYS[1], 'effectiveAt')) or -1
local recordedRank = tonumber(redis.call('HGET', KEYS[1], 'eventRank'))
if not recordedRank then
  if recordedAt < 0 then
    recordedRank = 0
  elseif (redis.call('HGET', KEYS[1], 'planId') or '') == '' and (redis.call('HGET', KEYS[1], 'planName') or '') == '' then
    recordedRank = ${EVENT_RANK.cancelled}
  else
    recordedRank = ${MAX_EVENT_RANK}
  end
end
local recordedId = redis.call('HGET', KEYS[1], 'eventDelivery') or ''
local versus = order(at, rank, id, recordedAt, recordedRank, recordedId)
if ARGV[1] == 'pending_cancelled' then
  if versus < 0 then return 0 end
  redis.call('HSET', KEYS[1], 'account', ARGV[3], 'pendingPlanId', '', 'pendingPlanName', '', 'pendingAt', '')
  return 0
end
if ARGV[1] == 'pending' then
  if versus < 0 then return 0 end
  redis.call('HSET', KEYS[1], 'account', ARGV[3], 'pendingPlanId', ARGV[4], 'pendingPlanName', ARGV[5], 'pendingAt', ARGV[2])
  return 0
end
if versus < 0 then return 0 end
if versus == 0 then return 2 end
local pendingAt = tonumber(redis.call('HGET', KEYS[1], 'pendingAt'))
redis.call('HSET', KEYS[1], 'account', ARGV[3], 'planId', ARGV[4], 'planName', ARGV[5], 'onFreeTrial', ARGV[6],
  'effectiveAt', ARGV[2], 'eventRank', ARGV[7], 'eventDelivery', id)
if not pendingAt or pendingAt <= at then
  redis.call('HSET', KEYS[1], 'pendingPlanId', '', 'pendingPlanName', '', 'pendingAt', '')
end
return 1
`;

const runPurchaseScript = async (accountId, kind, effectiveAt, login, plan, onFreeTrial, rank, deliveryId) => {
  const written = await redis.eval(APPLY_PURCHASE_SCRIPT, [`marketplace:${accountId}`], [
    kind,
    String(effectiveAt),
    login || '',
    String((plan && plan.id) || ''),
    (plan && plan.name) || '',
    onFreeTrial ? 'true' : 'false',
    String(rank),
    deliveryId || '',
  ]);
  return Number(written);
};

/**
 * Apply a marketplace_purchase webhook to marketplace:{account id}. Returns
 * the account ({ id, login }), whether its current plan changed and whether
 * this event set the current plan (now, or on an earlier delivery of it:
 * current), or null for a payload that isn't a purchase event. deliveryId is the delivery's
 * X-GitHub-Delivery, which only breaks ties (see EVENT_RANK).
 *
 * Events are ordered by effective_date, then EVENT_RANK, then delivery id:
 * one that orders before the plan already recorded is ignored, so a late or
 * redelivered event can't undo a newer change (a stale "purchased" can't
 * re-grant a cancelled plan, even one dated the same). Re-applying the same
 * event is a no-op. Pending events are a record of what GitHub announced;
 * they never set the tier, which only changes when changed or cancelled
 * arrives (and clears the pending change it carries out).
 */
const applyPurchaseEvent = async (payload, { deliveryId } = {}) => {
  const { action } = payload;
  const purchase = payload.marketplace_purchase;
  if (![...CURRENT_ACTIONS, ...PENDING_ACTIONS].includes(action)) return null;
  if (!purchase || !purchase.account || !purchase.account.id) return null;

  const account = { id: String(purchase.account.id), login: purchase.account.login, type: purchase.account.type };
  // An undated event sorts before any dated one, so it can't override one.
  const effectiveAt = Date.parse(payload.effective_date) || 0;
  const cancelled = action === 'cancelled';
  const kind = { pending_change: 'pending', pending_change_cancelled: 'pending_cancelled' }[action] || 'current';

  const result = await runPurchaseScript(
    account.id, kind, effectiveAt, account.login,
    cancelled ? null : purchase.plan, !cancelled && purchase.on_free_trial,
    EVENT_RANK[action], deliveryId
  );
  return { account, changed: result === 1, current: result >= 1 };
};

// Reconciliation with GitHub's Marketplace API, for deliveries GitHub never
// sent or that failed and weren't redelivered. marketplace-checked:{account
// id} marks an account as checked, for:
// - a day once the account has a recorded plan, so a missed change or
//   cancellation is noticed within a day;
const RECONCILE_TTL = 24 * 60 * 60;
// - 10 minutes when GitHub has no purchase and nothing is recorded (most
//   free accounts), so a missed purchase is noticed within 10 minutes
//   without a GitHub call on every request;
const NO_PURCHASE_TTL = 10 * 60;
// - a minute while a check runs or after it failed, so concurrent requests
//   make one call and a failure is retried soon rather than cached as free.
const CHECKING_TTL = 60;
// GitHub reporting no purchase is recorded as a cancellation dated this long
// before the lookup started, so it can't override a webhook from just before
// the lookup that GitHub's API didn't show yet.
const RECONCILE_GRACE_MS = 60 * 60 * 1000;

/**
 * Check an account's plan with GitHub (lookupAccount(accountId) resolves to
 * GET /marketplace_listing/accounts/{id}'s data, or null for a 404: no
 * purchase) unless it was checked recently, and record what GitHub reports
 * through APPLY_PURCHASE_SCRIPT, ranked below any webhook, so it can't
 * override a newer or same-dated delivery. recorded is the account's
 * marketplace: record, or null. Returns whether the record may have changed.
 * A failure only logs: the tier is read from what's recorded.
 */
const reconcileAccount = async (accountId, recorded, lookupAccount) => {
  const checkedKey = `marketplace-checked:${accountId}`;
  try {
    if (await redis.get(checkedKey)) return false;
    // Claim the check, so concurrent requests don't all ask GitHub
    if ((await redis.set(checkedKey, 'checking', { nx: true, ex: CHECKING_TTL })) !== 'OK') return false;

    const startedAt = Date.now();
    const listing = await lookupAccount(accountId);
    const purchase = listing && listing.marketplace_purchase;
    // The longer markers are set only once the write has succeeded: a failed
    // write keeps the one-minute marker, so it's retried soon.
    if (!purchase || !purchase.plan) {
      let changed = false;
      // A recorded plan GitHub no longer reports: a missed cancellation
      if (recorded && (recorded.planId || recorded.planName)) {
        changed = (await runPurchaseScript(
          accountId, 'current', startedAt - RECONCILE_GRACE_MS, recorded.account, null, false, EVENT_RANK.reconciled
        )) === 1;
      }
      await redis.set(checkedKey, 'none', { ex: recorded ? RECONCILE_TTL : NO_PURCHASE_TTL });
      return changed;
    }

    const effectiveAt = Date.parse(purchase.updated_at) || startedAt - RECONCILE_GRACE_MS;
    const changed = (await runPurchaseScript(
      accountId, 'current', effectiveAt, listing.login, purchase.plan, purchase.on_free_trial, EVENT_RANK.reconciled
    )) === 1;
    await redis.set(checkedKey, 'checked', { ex: RECONCILE_TTL });
    return changed;
  } catch (error) {
    console.error(`Marketplace lookup failed for account ${accountId}: ${error.message}`);
    // Whichever step failed, the account is held for a minute only
    try {
      await redis.set(checkedKey, 'checking', { ex: CHECKING_TTL });
    } catch (e) {
      // Redis is failing too: the claim's own TTL still holds
    }
    return false;
  }
};

/**
 * The tier an account (a GitHub user or organization id) has bought on the
 * Marketplace. Decided from the stored plan and the current mapping, so a
 * change to GITHUB_MARKETPLACE_PLANS applies without new purchase events.
 * With lookupAccount (see reconcileAccount()) and plans mapped, the stored
 * plan is first reconciled with GitHub's, unless it was checked recently.
 */
const getMarketplaceTier = async (accountId, lookupAccount) => {
  if (!accountId) return 'free';
  const key = `marketplace:${accountId}`;
  let data = await redis.hgetall(key);
  if (lookupAccount && isMarketplaceConfigured() && await reconcileAccount(String(accountId), data, lookupAccount)) {
    data = await redis.hgetall(key);
  }
  return data ? planTier(data.planId, data.planName) : 'free';
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
  reconcileAccount,
  getMarketplaceUrl,
};
