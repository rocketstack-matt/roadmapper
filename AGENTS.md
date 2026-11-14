# AGENTS.md

Roadmapper turns a GitHub repo's issues labelled `Roadmap: Now` / `Roadmap: Next` / `Roadmap: Later` into an embeddable SVG roadmap (plus `/view`, `/embed` and `/html` pages). Repos are onboarded by installing the Roadmapper GitHub App (primary) or by registering an API key and committing a `.roadmapper` file. Production: https://roadmapper.rocketstack.co.

The detailed architecture reference (Redis data model, verification and tier rules, webhook and Marketplace behaviour, layout constants) is @CLAUDE.md. Update it when you change behaviour it describes.

## Stack and layout

- Plain CommonJS JavaScript on Node.js `24.x` (pinned in `package.json` `engines`; this sets the Vercel runtime). No TypeScript, no bundler, no build step, no linter or formatter config.
- Package manager: **npm** (`package-lock.json`). Install with `npm ci`.
- `roadmap.js`: issue fetching and SVG rendering, shared by every endpoint.
- `api/*.js`: one Vercel serverless function per endpoint, routed by `vercel.json`. Repo-scoped handlers are wrapped in `withMiddleware()` (`lib/middleware.js`).
- `server.js`: Express server for local dev, delegating to the same `api/` handlers. A new endpoint needs a route in **both** `server.js` and `vercel.json` (`builds` and `routes`).
- `lib/`: Redis client, verification, tiers, rate limiting, caching, GitHub App auth, Marketplace billing, email, analytics.
- `scripts/`: operator CLIs that write to whatever Redis `.env` points at (`set-tier.js`, `fold-repo-keys.js`).
- `tests/`: Jest, mirroring `api/`, `lib/` and `scripts/`.
- `docs/`: product planning and Marketplace listing copy. `architecture/`: FINOS CALM model.

## Commands

All of these were run in this repo:

```bash
npm ci                                      # install (warns EBADENGINE on Node != 24; harmless)
npm test                                    # full Jest suite, about 3s, no network or services needed
npx jest tests/lib/marketplace.test.js      # one file
npx -y node@24 node_modules/.bin/jest       # suite on the deployed Node major
npm run run                                 # local server on :5002 (PORT overrides); note: `run`, not `start`
```

There is no `lint` or `build` script. Before pushing, run `npm test`, and the Node 24 run when you touch runtime-sensitive code. **No GitHub Actions workflows exist** (`.github` is gitignored), so the only check on a PR is the Vercel deployment and nothing else runs the tests.

## Environment and external services

Every variable is optional; see the table in CLAUDE.md and `.env.example`. With none set (the default locally and in tests), Redis is a no-op stub (`lib/redis.js`), middleware is skipped and every endpoint works unrestricted with no caching.

- **GitHub API**: `GITHUB_TOKEN` (shared PAT), or the GitHub App (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG`, `GITHUB_APP_WEBHOOK_SECRET`) for per-installation tokens and webhooks.
- **Upstash Redis** (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`): registrations, verification cache, tiers, issue cache, rate limits, Marketplace state.
- **GitHub Marketplace** (`GITHUB_MARKETPLACE_PLANS`, `GITHUB_MARKETPLACE_STUBBED`): paid plans for App installs.
- **Resend** (`RESEND_API_KEY`, `FROM_EMAIL`): registration confirmation email.
- **Google Analytics** (`GA_MEASUREMENT_ID`, `GA_API_SECRET`).
- `VERCEL_ENV`: anything but `production` turns on `[cache …]` and `[webhook …]` debug logs.

Tiers (`lib/tiers.js`): `free` = 60 min soft cache, 1000 req/h; `paid` = 30 s (900 s when webhook-driven), 10000 req/h.

## Deployment

Vercel, configured by `vercel.json`. A push to `main` deploys to production; every other branch gets a preview deployment. Merging is releasing, so open a PR and leave merging to the maintainer.

## Risky areas

- **Billing and tiers** (`lib/marketplace.js`, `getInstallationTier()` in `lib/github-app.js`, `marketplace_purchase` in `api/webhook.js`): this code decides who gets paid service. Event ordering, idempotency and reconciliation are subtle. `APPLY_PURCHASE_SCRIPT` is a Redis Lua script, so check-and-write stays atomic; never replace it with a read then a write. Installed repos' tiers are read live and must not be cached. Changes here need tests in `tests/lib/marketplace.test.js`, `tests/api-billing.test.js` and/or `tests/api-webhook.test.js`.
- **Webhook signature** (`api/webhook.js`): HMAC is checked over the raw body. The route is registered before `express.json()` in `server.js`; never parse the body before verifying it.
- **Private repos**: only public repos may be served through the App. Keep the visibility check in `verifyRepo()` and never fall back to `GITHUB_TOKEN` for an installed repo.
- **Secrets**: installation tokens live in process memory only, never in Redis, logs or responses.
- **Scripts** write live Redis when `.env` has production credentials. Don't run them without being asked.

## Pitfalls

- Issue titles, group names and URLs are user-controlled: pass them through `escapeXml()` before interpolating into SVG/HTML, but measure the raw title with `estimateTitleLines()`.
- Card geometry comes only from `buildGlobalLayout()`; `createColumn()`, `api/embed.js` and `api/html.js` must read it rather than recompute it.
- Build every Redis key containing `owner/repo` with `repoSlug()` (lowercased). Read `repo-key:` through `getRepoKeyHash()`.
- GitHub's `labels` filter is AND-only, so each roadmap label is fetched separately and merged. PRs come back from `/issues` and are filtered out.
- Tests: mock `axios` and `../lib/redis`. Code using `redis.eval` needs `evalLua` from `tests/redis-lua.js` as the mock, so the real Lua runs. After `jest.clearAllMocks()`, re-set default mock implementations. Set Upstash env vars before requiring the middleware.
- When legal text in `api/legal.js` changes, bump `LAST_UPDATED`. Update the privacy policy when a new data processor is added.
- `npm audit` reports existing advisories. Don't run `npm audit fix --force` or edit `package-lock.json` by hand.
