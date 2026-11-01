<p align="center" style="margin-bottom: 8px;">
  <img src="https://roadmapper.rocketstack.co/logo.svg" alt="Roadmapper Logo" width="200">
</p>

<h1 align="center" style="margin-top: 0;">Roadmapper</h1>

<p align="center">
  <strong>Transform your GitHub issues into beautiful, visual roadmaps</strong>
</p>

<p align="center">
  A simple, elegant way to visualize your project roadmap using GitHub issues. Roadmapper automatically generates beautiful SVG roadmaps from your GitHub issues based on labels, making it easy to communicate your project's priorities and timeline.
</p>

<p align="center">
  <a href="https://roadmapper.rocketstack.co">Website</a> •
  <a href="#live-example">Live Example</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#usage">Usage</a>
</p>

---

## What is Roadmapper?

Roadmapper transforms your GitHub issues into a clean, three-column visual roadmap that's perfect for:
- Project README files
- Documentation sites
- Status pages
- Team dashboards

Simply add one of three labels to your GitHub issues—<span style="display: inline-block; padding: 2px 8px; font-size: 12px; font-weight: 600; line-height: 18px; border-radius: 12px; background: #2da44e; color: white;">Roadmap: Now</span>, <span style="display: inline-block; padding: 2px 8px; font-size: 12px; font-weight: 600; line-height: 18px; border-radius: 12px; background: #fb8500; color: white;">Roadmap: Next</span>, or <span style="display: inline-block; padding: 2px 8px; font-size: 12px; font-weight: 600; line-height: 18px; border-radius: 12px; background: #8b949e; color: white;">Roadmap: Later</span>—and Roadmapper does the rest.

## Live Example

Here's what this project's roadmap looks like:

[![Roadmap](https://roadmapper.rocketstack.co/rocketstack-matt/roadmapper/ffffff/24292f)](https://roadmapper.rocketstack.co/view/rocketstack-matt/roadmapper/ffffff/24292f)

> **💡 Click the roadmap image above** to open the interactive viewer where each card is clickable and links directly to its GitHub issue. Due to GitHub's security restrictions, roadmap cards cannot be made clickable when embedded directly in markdown.

## Getting Started

1. **Install the Roadmapper GitHub App** from the Get Started section at [roadmapper.rocketstack.co](https://roadmapper.rocketstack.co) and choose the repositories you want roadmaps for. There's no key and no file to commit: installing the App shows you own the repo. GitHub then sends you to a setup page listing your connected repos and their embed URLs. Only public repositories are supported for now.

   **Can't install the App?** If you can't get approval to install a GitHub App on your organization, use an API key instead — see [Using an API key instead](#using-an-api-key-instead).

2. **Label your issues**: Add one of these labels to your GitHub issues:
   - <span style="display: inline-block; padding: 2px 8px; font-size: 12px; font-weight: 600; line-height: 18px; border-radius: 12px; background: #2da44e; color: white;">Roadmap: Now</span> - Top priority items you're working on right now
   - <span style="display: inline-block; padding: 2px 8px; font-size: 12px; font-weight: 600; line-height: 18px; border-radius: 12px; background: #fb8500; color: white;">Roadmap: Next</span> - Next priority items planned for soon
   - <span style="display: inline-block; padding: 2px 8px; font-size: 12px; font-weight: 600; line-height: 18px; border-radius: 12px; background: #8b949e; color: white;">Roadmap: Later</span> - Longer-term items under consideration

3. **Embed your roadmap**: Use the URL format:
   ```
   https://roadmapper.rocketstack.co/{owner}/{repo}/{bgColor}/{textColor}
   ```

4. **Add to your README**: Link to the interactive viewer page where users can click on items:
   ```markdown
   [![Roadmap](https://roadmapper.rocketstack.co/owner/repo/ffffff/24292f)](https://roadmapper.rocketstack.co/view/owner/repo/ffffff/24292f)
   ```

### Using an API key instead

1. **Register your repository** in the "Can't install the App? Use an API key" section at [roadmapper.rocketstack.co](https://roadmapper.rocketstack.co) — enter your GitHub owner, repo name, and email to receive your API key.
2. **Confirm your email** — click the confirmation link sent to your email. Your key activates after confirmation (the link expires in 24 hours).
3. **Add a `.roadmapper` file** to the root of your repository containing the API key you received (see below). Commit and push.
4. Label your issues and embed your roadmap as above.

### The `.roadmapper` File

The `.roadmapper` file proves you own the repository and authorizes Roadmapper to generate roadmaps for it. It should contain only the API key you received during registration:

```
rm_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
```

Place this file in the root of your repository. Roadmapper checks this file periodically (every 24 hours) to verify your registration.

## How It Works

## Usage

### URL Format

```
https://roadmapper.rocketstack.co/{owner}/{repo}/{bgColor}/{textColor}
```

**Parameters:**
- `owner` (required): GitHub repository owner/organization
- `repo` (required): GitHub repository name
- `bgColor` (required): Background color as hex code without # (e.g., `ffffff`, `f6f8fa`)
- `textColor` (required): Text color as hex code without # (e.g., `24292f`, `000000`)

### Examples

**White background with dark text:**
```
https://roadmapper.rocketstack.co/facebook/react/ffffff/24292f
```

**Dark background with light text:**
```
https://roadmapper.rocketstack.co/facebook/react/0d1117/e6edf3
```

**Light gray background with dark text (GitHub style):**
```
https://roadmapper.rocketstack.co/facebook/react/f6f8fa/24292f
```

### In Your README

**Recommended: Interactive Roadmap Link**

This shows a preview image that links to a page where each card is clickable:

```markdown
## Roadmap

[![Roadmap](https://roadmapper.rocketstack.co/your-username/your-repo/ffffff/24292f)](https://roadmapper.rocketstack.co/view/your-username/your-repo/ffffff/24292f)

> Click the roadmap to view the interactive version with clickable cards.
```

**Alternative: Static Image Only**

If you just want a static roadmap image without clickable links:

```markdown
![Roadmap](https://roadmapper.rocketstack.co/your-username/your-repo/ffffff/24292f)
```

**For Documentation Sites (Non-GitHub)**

If you're embedding in a website or documentation site that supports HTML, you can use the clickable embed:

```html
<iframe src="https://roadmapper.rocketstack.co/embed/your-username/your-repo/ffffff/24292f" width="100%" height="520" frameborder="0"></iframe>
```

Or [generate HTML code](https://roadmapper.rocketstack.co/html/rocketstack-matt/roadmapper/ffffff/24292f) with image maps for more direct embedding (replace `rocketstack-matt/roadmapper` with your repository).

> **GitHub Limitation:** GitHub's markdown renderer strips iframes and may not support HTML image maps for security reasons. For GitHub READMEs, use the recommended link approach above.

## Custom Colors

Roadmapper supports fully customizable colors for your roadmap. You can specify:
- **Background color** (`bgColor`): Used for the roadmap background and card backgrounds
- **Text color** (`textColor`): Used for all text, headers, and drop shadows

Colors are specified as hex codes **without the # symbol**. Both 3-digit and 6-digit hex codes are supported.

### Color Examples

- **Classic light**: `ffffff/24292f` - White background, dark text
- **GitHub style**: `f6f8fa/24292f` - Light gray background, dark text
- **Dark mode**: `0d1117/e6edf3` - Dark background, light text
- **Navy**: `001f3f/ffffff` - Navy background, white text
- **Forest**: `2c5f2d/ffffff` - Forest green background, white text

### Color Tips

- Use high contrast between background and text for readability
- The label accent colors (from your GitHub labels) will still show on card borders
- Invalid hex codes will fall back to white background with dark text

## Setup & Development

### Prerequisites
- Node.js 24.x (the deployed runtime, pinned via `engines` in `package.json`). Newer majors work locally, but `npm install` warns `EBADENGINE`.
- npm

### Installation

```bash
npm install
```

### Running Locally

Start the local development server:
```bash
npm run run
```

The server will start on port 5002 (or the port specified in the `PORT` environment variable).

Access your roadmap locally at:
```
http://localhost:5002/{owner}/{repo}/{bgColor}/{textColor}
```

Example:
```
http://localhost:5002/rocketstack-matt/roadmapper/ffffff/24292f
```

## Deployment

This project can be deployed to any serverless platform that supports Node.js:

1. Fork this repository
2. Connect to your hosting platform (e.g., Vercel)
3. Set environment variables:
   - `GITHUB_TOKEN` — GitHub Personal Access Token (recommended, for higher API rate limits)
   - `GITHUB_APP_ID` — GitHub App ID (optional; with the private key, repos that install the App are read with their own installation token and need no `.roadmapper` file)
   - `GITHUB_APP_PRIVATE_KEY` — GitHub App private key in PEM format (literal `\n` escapes are accepted)
   - `GITHUB_APP_WEBHOOK_SECRET` — GitHub App webhook secret (optional; enables `POST /api/webhook`, which refreshes paid installed repos within seconds of a change)
   - `GITHUB_APP_SLUG` — the App's slug, from `https://github.com/apps/<slug>` (optional; with the App variables, shows "Install the GitHub App" on the landing page)
   - `UPSTASH_REDIS_REST_URL` — Upstash Redis REST URL (required for registration, rate limiting, caching)
   - `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis REST token
   - `RESEND_API_KEY` — Resend API key (optional, enables email confirmation on registration)
   - `FROM_EMAIL` — Sender email address (optional, defaults to `Roadmapper <noreply@roadmapper.rocketstack.co>`)
4. Deploy

Without the GitHub App variables, every repo is read with `GITHUB_TOKEN` and verified with its `.roadmapper` file. Without the Upstash Redis variables, the service runs unrestricted (no registration required, no rate limits, no caching). Without `RESEND_API_KEY`, keys work immediately after registration (no email confirmation required).

## How Labels Work

Roadmapper looks for these exact label names on your GitHub issues:

- <span style="display: inline-block; padding: 2px 8px; font-size: 12px; font-weight: 600; line-height: 18px; border-radius: 12px; background: #2da44e; color: white;">Roadmap: Now</span> - Items appear in the "Now" column
- <span style="display: inline-block; padding: 2px 8px; font-size: 12px; font-weight: 600; line-height: 18px; border-radius: 12px; background: #fb8500; color: white;">Roadmap: Next</span> - Items appear in the "Next" column
- <span style="display: inline-block; padding: 2px 8px; font-size: 12px; font-weight: 600; line-height: 18px; border-radius: 12px; background: #8b949e; color: white;">Roadmap: Later</span> - Items appear in the "Later" column

### Label Colors

Roadmapper automatically extracts and uses the actual colors from your GitHub labels. Each roadmap card displays a colored accent border at the top that matches the color you've set for that label in your GitHub repository. This means you can customize the appearance of your roadmap by simply changing the label colors in GitHub—no configuration needed!

If a label color cannot be determined, the card will use a default gray color.

Issues are automatically sorted by issue number within each column.

### Grouping Issues

You can visually group related issues within a column by adding `Roadmap Group: <name>` labels. For example:

- `Roadmap Group: Frontend` — groups all frontend-related issues together
- `Roadmap Group: API` — groups API work together
- `Roadmap Group: Auth` — groups authentication issues together

**How to use:**
1. Create labels in GitHub with the `Roadmap Group: ` prefix (e.g., `Roadmap Group: Frontend`)
2. Apply both a column label (`Roadmap: Now`) and a group label (`Roadmap Group: Frontend`) to an issue
3. Issues with the same group label are rendered together under a group header
4. Ungrouped issues (no group label) appear at the bottom of the column
5. Groups are sorted alphabetically; the group header uses the label's color as an accent

Grouping is fully optional — if no issues have group labels, the roadmap displays exactly as before.

## Features

- ✨ Clean, modern SVG output
- 🎨 Fully customizable colors (background and text)
- 🎨 Automatic label color matching from GitHub
- 📂 Optional issue grouping within columns via `Roadmap Group: <name>` labels
- 🔄 Automatic updates from GitHub issues (free tier refreshes hourly)
- 📱 Responsive design
- 🚀 Serverless deployment ready
- 🔑 Per-repository API keys with rate limiting
- ⚡ Built-in response caching for fast load times

## Rate Limits & Caching

Roadmapper uses per-repository rate limiting and response caching:

| Tier | Roadmap Refresh | Rate Limit |
|------|-----------------|------------|
| Free (App installed or API key) | Every 60 minutes | 1,000 requests/hour |
| Paid, with an API key | Every 30 seconds | ~Unlimited |
| Paid, with the GitHub App installed | Within seconds of an issue changing | ~Unlimited |

Every install and registration starts on the free tier. Paid plans are arranged directly with us for now (no GitHub Marketplace listing yet) — [get in touch](https://github.com/rocketstack-matt/roadmapper/issues). A paid GitHub App installation covers every repo in it.

The cache TTL controls how often your roadmap data refreshes from GitHub. All viewers within the cache window see the same cached response. The rate limit is a secondary protection against abuse.

Paid repos with the Roadmapper GitHub App installed don't wait for a timer: GitHub notifies Roadmapper by webhook when a roadmap issue or label changes, and the next request fetches fresh data. Their SVG is also sent with `Cache-Control: no-cache`, so GitHub's image proxy and browsers don't keep showing an old copy. In case a webhook is ever missed, their cache still refreshes every 15 minutes.

### GitHub API Rate Limits

Roadmapper also uses the GitHub API, which has its own rate limits:
- **Unauthenticated requests**: 60 requests per hour per IP
- **Authenticated requests**: 5,000 requests per hour

### Adding GitHub Authentication (Recommended for Production)

To increase the rate limit to 5,000 requests/hour, add a GitHub Personal Access Token:

1. **Create a GitHub Personal Access Token:**
   - Go to https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Give it a name like "Roadmapper"
   - Select scope: **`public_repo`** (read access to public repositories)
   - Click "Generate token" and copy the token

2. **Add the token to your environment:**

   **For local development:**
   ```bash
   # Create a .env file in the project root
   echo "GITHUB_TOKEN=your_token_here" > .env
   ```

   **For production (Vercel):**
   - Go to your Vercel project settings
   - Navigate to "Environment Variables"
   - Add: `GITHUB_TOKEN` = `your_token_here`

3. **Restart the server** - The token will be automatically used for all GitHub API requests.

**Security Note:** Never commit your `.env` file or expose your token in public repositories.

### GitHub App Authentication (Optional)

Instead of sharing one token across every roadmap, a deployment can read repos through a GitHub App: each repo where the App is installed is read with that installation's own token (and its own rate limit), and needs no `.roadmapper` file. Repos without the App keep using `GITHUB_TOKEN` and the `.roadmapper` file.

Only public repos are served through the App. A private repo in an installation is refused, and a repo made private stops being served within a minute. Tokens are scoped to the one repo being read, with read-only Issues, Contents and Metadata, and are kept in memory only.

1. **Create a GitHub App** (Settings → Developer settings → GitHub Apps → New GitHub App) with these repository permissions, all read-only:
   - **Issues**: Read — to fetch roadmap issues
   - **Metadata**: Read — required by GitHub for every App
   - **Contents**: Read — to read `.roadmapper` files
2. **Set the Setup URL** to `https://<your-domain>/setup` and tick **Redirect on update**. After installing (or changing which repos the App can read) GitHub sends the user there, to a page listing the installation's public repos and their embed URLs. The page needs no sign-in, so it never names private repos, only counts them.
3. **Set up the webhook** (optional, but needed for real-time updates):
   - **Webhook URL**: `https://<your-domain>/api/webhook`
   - **Webhook secret**: a long random string (for example `openssl rand -hex 32`)
   - **Subscribe to events**: Issues, Label and Repository (installation events are always sent)

   Without webhooks, installations are still discovered on first request and roadmaps refresh on their tier's timer.
4. **Generate a private key** for the App and note its **App ID** and its slug (the last part of its public page URL, `https://github.com/apps/<slug>`).
5. **Set the environment variables** `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (the PEM contents; on one line, newlines may be written as `\n`), `GITHUB_APP_SLUG` and, with webhooks, `GITHUB_APP_WEBHOOK_SECRET`.
6. **Install the App** on the repositories whose roadmaps you want to serve.

Webhook deliveries are rejected unless their `X-Hub-Signature-256` signature matches the secret. With webhooks, a repo made private stops being served immediately rather than within a minute.

### Setting a tier

Installations and API keys start on the free tier. Billing is direct for now, so a paid plan is switched on by hand:

```bash
node scripts/set-tier.js --installation <installation-id> paid   # every repo in an installation
node scripts/set-tier.js <owner> <repo> paid                     # a repo's installation and/or API key
node scripts/set-tier.js --installation <installation-id> free   # back to free
```

The installation id is the number in the installation's settings URL (`github.com/settings/installations/<id>`, or `github.com/organizations/<org>/settings/installations/<id>`) and in the setup page URL. The new tier applies on each repo's next request.

The `<owner> <repo>` form finds the repo's installation from the mapping cached in Redis, so it needs only the Upstash credentials once the repo has been requested; with nothing cached it looks it up on GitHub, which needs `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY`. If it can't tell whether the repo is installed it says so and exits with an error instead of reporting success: use `--installation <id>` then.

## License

Apache 2.0 - See [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.
