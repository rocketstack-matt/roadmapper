# What comes next for Roadmapper

The next milestone is **turn a new GitHub App installation into a useful, embedded roadmap**, followed closely by **private repositories**. The App foundation is in place; the first product risk is whether someone can get value from it without help, and the owner wants private repos soon after.

## Backlog at a glance

| Column | Issue | Notes |
| --- | --- | --- |
| Now | #11 Paid tier | Billing goes straight to GitHub Marketplace: `marketplace_purchase` webhooks set the tier through `getInstallationTier()`. Left: publisher verification, the paid plan on the listing, and the plan id in `GITHUB_MARKETPLACE_PLANS` (see [Marketplace listing](marketplace-listing.md#paid-plan-setup)). |
| Next | #4 Private repositories | Signed, rotatable links; paid. See [Private repositories](#2-private-repositories-4). |
| Next | #6 Rate-limit monitoring | Not started. Overlaps the operational signals in step 3. |
| Next | #29 Harden `/setup` | The setup page mints a token on every visit. |
| Later | #2 SVG rendering performance, #8 Multi-language text, #9 Custom column names and categories | |

Closed: #10 GitHub App, #7 Webhooks.

## What is already built

- App installation replaces the `.roadmapper` file for public repositories; API keys remain a fallback.
- The setup page walks each connected public repository through creating the three labels (copyable names and suggested colours, a link to the repo's labels page), labelling an open issue (a new-issue link with `Roadmap: Now` prefilled), previewing the roadmap with tier-specific freshness guidance, and copying the Markdown or iframe snippet (`api/setup.js`).
- Installation tokens, visibility checks and lifecycle webhooks support repository access (`lib/github-app.js`, `api/webhook.js`).
- Free installations refresh hourly. Paid installations support webhook invalidation, with a 15-minute safety refresh; paid without configured webhooks uses a 30-second timer (`lib/tiers.js`).
- Paid tiers come from a GitHub Marketplace plan (`lib/marketplace.js`, `marketplace_purchase` webhooks) or are assigned manually with `scripts/set-tier.js`; an installation gets the higher of the two. Checkout, plan changes and cancellation are GitHub's.
- Analytics includes page snippets and a server-side `roadmap_view` event (`lib/analytics.js`, `api/roadmap.js`). That event alone does not establish activation or retention.

## 1. Complete the install-to-first-roadmap journey

The setup page guide is the first part. It keeps the App's read-only permissions: automatically creating labels would need write access and an explicit product decision.

Still to do:

- **Empty-roadmap guidance where people see it.** A roadmap with no labelled issues renders three empty columns. Show a short "label an issue with Roadmap: Now" hint in the SVG and viewer when every column is empty.
- **Faster first refresh for free installs.** A preview opened before labelling caches an empty result for up to an hour. Consider not caching an empty result as fresh (or a short TTL for empty results) so a new user sees their first issue quickly; it needs a rate limit so empty repos can't be polled for free.
- **Verify the README experience through GitHub's image proxy** before making stronger refresh promises.

**Acceptance:** someone unfamiliar with Roadmapper can install it on a public test repo, create and label an issue, copy the snippet, and see that issue in their README and linked viewer without a key, file commit for registration, or operator assistance. Cover no public repos, no matching issues, pending organization approval, and the free refresh delay.

## 2. Private repositories (#4)

Private repos are a **Next** item, a paid feature served through **signed, rotatable links**. Installation access tells us the App may read a repo; it says nothing about who may view its roadmap, and today's URLs are public. A signed link makes viewing an explicit, revocable decision by the installation's administrator.

Design points to settle in #4:

- **Who issues links.** Creating or rotating a link must require proof that the person manages the installation (GitHub OAuth against the installation, for example). The current unauthenticated setup page must not hand out private links; this depends on hardening `/setup` (#29).
- **Link shape and verification.** A secret per repo (or per link) stored hashed in Redis, carried in the URL and checked by the middleware before any GitHub call, so the SVG, viewer, embed and HTML routes all honour it. Rotating the secret revokes every old link at once.
- **What the token reads.** Private repos need the installation token with the same read-only scope; `getGitHubHeaders()` currently throws `PrivateRepoError` for them, and that check moves behind the signed-link verification rather than going away.
- **Caching.** Issue caches for private repos must never be served without a valid link; set `Cache-Control: private` (or `no-store`) so GitHub's image proxy and shared caches don't keep them.
- **Tier.** Private access only for paid installations, decided through `getInstallationTier()`; a downgrade stops serving private links.
- **Lifecycle.** `repository.privatized` keeps working as now (forget the repo); a repo made private needs a new signed link before it serves again, so public URLs never start showing private data.

**Acceptance:** an installation administrator on a paid plan can create, copy and rotate a link for a private repo; the link renders on every route; an old or tampered link, an unpaid installation or an unauthenticated setup visit never returns private issue data.

## 3. Measure activation and run a small pilot

Add a minimal funnel: install-link click, successful installation observed, setup viewed, snippet copied and first successful non-empty roadmap rendered. Distinguish installs from updates and deduplicate webhook retries. A setup page visit with an installation id is not proof that its visitor owns the installation.

Record aggregate operational signals for webhook failures, GitHub API errors and rate limits (#6), and roadmap fetch failures. Avoid issue titles, emails, credentials or private repository information in analytics.

Recruit a handful of public projects and watch the setup journey. Define activation as a connected repo with a non-empty roadmap and an embed confirmed by its maintainer.

**Acceptance:** we can explain where pilot users stop, confirm which embeds work, inspect failed deliveries, and distinguish real adoption from our own demo traffic.

## 4. Finish the paid offer (#11) on GitHub Marketplace

The owner chose GitHub Marketplace over direct billing. GitHub handles checkout, the billing portal, upgrades, downgrades and cancellation, and it ties the purchase to the GitHub account the App is installed on, so we don't need our own payer authentication. `marketplace_purchase` webhooks are signature-verified and ordered by `effective_date`, and they feed `getInstallationTier()` rather than a parallel entitlement system. The manual tier command stays for direct deals and API-key repos.

Still to do: publisher verification, the paid plan and its price on the listing, and mapping the plan id in `GITHUB_MARKETPLACE_PLANS`. Paid also covers private repositories once #4 is built.

**Acceptance:** an account owner can buy, change and cancel the plan on the Marketplace listing and every installation of the account follows it; retries and out-of-order events cannot grant an incorrect tier; public setup links cannot change billing.

## Defer until evidence justifies them

| Work | Why defer | Trigger to reconsider |
| --- | --- | --- |
| Automatic label creation | Requires broader App permissions than today's read-only setup. | Pilot users repeatedly fail at label setup despite the guided instructions. |
| More themes, custom columns (#9), multi-repo boards | None resolves the install-to-value journey. | Repeated requests from active users identify a concrete priority. |
