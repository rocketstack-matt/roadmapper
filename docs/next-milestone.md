# What comes next for Roadmapper

The next milestone should be **turn a new GitHub App installation into a useful, embedded roadmap**. The App foundation is in place; the next product risk is whether someone can get value from it without help. Validate that journey with a small public-repository pilot before expanding the feature set.

## What is already built

- App installation replaces the `.roadmapper` file for public repositories; API keys remain a fallback.
- The setup page lists connected public repositories and provides Markdown, iframe and viewer links (`api/setup.js`).
- Installation tokens, visibility checks and lifecycle webhooks support repository access (`lib/github-app.js`, `api/webhook.js`).
- Free installations refresh hourly. Paid installations support webhook invalidation, with a 15-minute safety refresh; paid without configured webhooks uses a 30-second timer (`lib/tiers.js`).
- Paid tiers can be assigned manually with `scripts/set-tier.js`. There is no self-service checkout.
- Analytics includes page snippets and a server-side `roadmap_view` event (`lib/analytics.js`, `api/roadmap.js`). That event alone does not establish activation or retention.

These findings come from the current branch's source and documentation. They do not independently verify production configuration, webhook delivery, usage or revenue. The live GitHub issue backlog could not be retrieved from this runner, so this is a proposed order of work, not a reconciliation of existing issues.

## 1. Complete the install-to-first-roadmap journey

Make the setup page guide someone through selecting a public repository, adding the three exact labels, labelling an issue, previewing the result and copying the README snippet.

Start with links to GitHub's label and issue screens, copyable label names and colors, an example issue, a preview link, and clear guidance for an empty roadmap. Keep the App's current read-only permissions: automatically creating labels would require write access and an explicit product decision.

Be honest about freshness. Free users may wait up to an hour after an empty result has been cached; paid webhook updates still require the image to be requested again. Verify the actual README experience through GitHub's image proxy before making stronger refresh promises. A one-time onboarding refresh could be considered separately if the free delay prevents activation; it would need an abuse limit.

**Acceptance:** someone unfamiliar with Roadmapper can install it on a public test repo, create and label an issue, copy the snippet, and see that issue in their README and linked viewer without a key, file commit for registration, or operator assistance. Cover no public repos, no matching issues, pending organization approval, and the free refresh delay.

## 2. Measure activation and run a small pilot

Add a minimal funnel: install-link click, successful installation observed, setup viewed, snippet copied and first successful non-empty roadmap rendered. Distinguish installs from updates and deduplicate webhook retries. A setup page visit with an installation id is not proof that its visitor owns the installation.

Record aggregate operational signals for webhook failures, GitHub API errors and rate limits, and roadmap fetch failures. Avoid issue titles, emails, credentials or private repository information in analytics. Prefer a small operational summary over building a customer dashboard.

Recruit a handful of public projects and watch the setup journey. Define activation as a connected repo with a non-empty roadmap and an embed confirmed by its maintainer. Treat later roadmap requests as a usage signal, not proof of human retention: image proxies, bots and caching distort request counts.

**Acceptance:** we can explain where pilot users stop, confirm which embeds work, inspect failed deliveries, and distinguish real adoption from our own demo traffic. Use those observations to choose the next investment.

## 3. Validate the paid offer, then automate billing

The first paid offer can stay focused on faster updates for all public repos in an installation. Use the existing manual tier command for early customers while checking willingness to pay and deciding price and billing unit.

Once demand is demonstrated, add authenticated installation management and self-service checkout. Bind the payer to an installation they are authorized to manage; the current unauthenticated setup page is not an authorization mechanism. Implement verified, idempotent billing webhooks, upgrade/downgrade handling, cancellation and a billing portal. Reuse the existing installation-tier seam rather than adding a parallel entitlement system.

**Acceptance:** a verified installation administrator can buy, manage and cancel a plan; retries and out-of-order billing events cannot grant an incorrect tier; public setup links cannot change billing.

## Defer until evidence justifies them

| Work | Why defer | Trigger to reconsider |
| --- | --- | --- |
| Private repositories | Existing SVG, viewer and embed URLs are public. Installation access alone cannot authorize every viewer. | Customers need private roadmaps and agree on authenticated viewing or explicitly publishing selected issue data. |
| GitHub Marketplace billing | Direct billing/manual tiers already provide a way to test the offer. | Marketplace distribution or procurement becomes a demonstrated requirement. |
| Automatic label creation | Requires broader App permissions than today's read-only setup. | Pilot users repeatedly fail at label setup despite guided instructions. |
| More themes, custom columns, multi-repo boards | None resolves the unvalidated install-to-value journey. | Repeated requests from active users identify a concrete priority. |

## Suggested next task

**Guide new GitHub App installs to their first roadmap.** Improve the existing setup journey with label instructions, GitHub links, preview guidance and empty-state help. Preserve read-only permissions, public-only access and the API-key fallback. Verify the journey on a fresh public repository and add focused tests for changed setup behavior. Follow with activation instrumentation and the pilot; keep billing as a subsequent milestone.
