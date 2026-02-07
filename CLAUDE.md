# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Roadmapper is a Node.js service that generates dynamic SVG roadmap visualizations from GitHub issues. It reads GitHub issues with specific labels and renders them as a three-column roadmap (Now/Later/Future). The project includes a landing page, multiple embedding options, and automatic label color matching.

**Production URL**: https://roadmapper.rocketstack.co

## Architecture

The project supports two deployment modes:
1. **Serverless** (production): Uses Vercel serverless functions in `api/` directory
2. **Express Server** (local development): Uses `server.js` with Express routing

### Core Logic (`roadmap.js`)

Shared by both deployment modes:
- `fetchIssues(owner, repo)`: Fetches GitHub issues via the GitHub API
- `generateRoadmapSVG(issues, bgColor, textColor)`: Generates SVG content with custom colors
- `validateHexColor(color)`: Validates hex color codes (3 or 6 digits)
- `normalizeHex(hex)`: Converts 3-digit hex to 6-digit format
- `hexToRgba(hex, alpha)`: Converts hex colors to rgba with transparency

**Label Color Extraction**: The service automatically extracts the actual color from GitHub labels and applies them as accent borders on roadmap cards. Each issue's label color is stored and used in the SVG generation.

### Issue Label Classification

The roadmap automatically categorizes issues into columns based on labels:
- **"Roadmap: Now"**: Top priority items currently being worked on
- **"Roadmap: Later"**: Next priority items planned for soon
- **"Roadmap: Future"**: Longer-term items under consideration

Issues are sorted by issue number and rendered in their respective columns.

### Custom Color System

The service supports fully customizable colors via two URL parameters:
- `bgColor`: Background color as hex (without #) - used for SVG background and card backgrounds
- `textColor`: Text color as hex (without #) - used for headers, text, and shadows

**Color Mapping:**
- Background: Uses `bgColor` directly
- Card background: Uses `bgColor`
- Header text: Uses `textColor`
- Subtitle text: Uses `textColor` with 0.7 opacity
- Card text: Uses `textColor`
- Shadows: Uses `textColor` with 0.08-0.12 opacity
- Label borders: Uses GitHub label colors (unchanged)

**Validation:**
- Supports both 3-digit and 6-digit hex codes
- Invalid colors fall back to `ffffff` (white) for background and `24292f` (dark gray) for text
- The # symbol should be omitted from URLs

**Note**: The web pages (landing, viewer, embed, html) have independent light/dark theme toggles for the HTML page styling. The viewer and html pages also have preset cycling buttons that allow users to switch between predefined color combinations.

## Development Commands

Start the local Express server:
```bash
npm run run
```

The server runs on port 5002 by default (configurable via PORT environment variable).

Run the test suite:
```bash
npm test
```

**Important: Always run `npm test` before committing any changes.** All tests must pass before code is committed.

## Testing

The project uses **Jest** for testing. Tests live in the `tests/` directory.

### Test Files

- `tests/helpers.js`: Shared mock data and test utilities (mock req/res, mock issues)
- `tests/roadmap.test.js`: Core logic tests (`validateHexColor`, `normalizeHex`, `hexToRgba`, `generateRoadmapSVG`, `fetchIssues`)
- `tests/api-roadmap.test.js`: SVG generator endpoint tests (URL parsing, redirects, error handling)
- `tests/api-view.test.js`: Interactive viewer endpoint tests (HTML output, environment detection, presets)
- `tests/api-embed.test.js`: Embed endpoint tests (image map generation, coordinate calculation)
- `tests/api-html.test.js`: HTML code generator endpoint tests (code generation, copy functionality, HTML escaping)
- `tests/api-index.test.js`: Landing page endpoint tests (sections, features, theme toggle)

### Writing Tests

- Mock `axios` for any tests involving `fetchIssues` to avoid real API calls
- Use `createMockReq(url, headers)` and `createMockRes()` from `tests/helpers.js` for endpoint tests
- Use `createMockIssue(number, title, labelName, labelColor)` for creating test issue data
- API endpoint handlers are tested directly with mock req/res objects (no HTTP server needed)

## API Endpoints

All endpoints share the same URL parameters:
- `owner`: GitHub repository owner/organization
- `repo`: GitHub repository name
- `bgColor`: Background color as hex without # (e.g., `ffffff`, `f6f8fa`)
- `textColor`: Text color as hex without # (e.g., `24292f`, `e6edf3`)

### Main Endpoints

#### 1. Landing Page (`api/index.js`)
```
GET /
```
The main landing page with:
- Logo and branding
- How it works section
- Live example with embedded roadmap
- Get Started section with URL format explanation and tabbed embedding options
- Features showcase
- Light/dark mode theme toggle

#### 2. Roadmap SVG Generator (`api/roadmap.js`)
```
GET /:owner/:repo/:bgColor/:textColor
```
Returns the SVG roadmap image. This is the core endpoint that generates the visual roadmap.

Example: `https://roadmapper.rocketstack.co/facebook/react/ffffff/24292f`

#### 3. Interactive Viewer (`api/view.js`)
```
GET /view/:owner/:repo/:bgColor/:textColor
```
A full HTML page that embeds the SVG roadmap with clickable links. Used as a workaround for GitHub's markdown restrictions (GitHub strips interactive elements from embedded SVGs). Includes a preset cycling button.

Example: `https://roadmapper.rocketstack.co/view/facebook/react/ffffff/24292f`

#### 4. Embed Page (`api/embed.js`)
```
GET /embed/:owner/:repo/:bgColor/:textColor
```
An iframe-embeddable page with HTML image maps for clickable roadmap cards. Designed for embedding on websites and documentation sites.

Example: `https://roadmapper.rocketstack.co/embed/facebook/react/ffffff/24292f`

#### 5. HTML Code Generator (`api/html.js`)
```
GET /html/:owner/:repo/:bgColor/:textColor
```
A utility page that generates and displays HTML code with image maps for direct embedding. Shows:
- Preview of the clickable roadmap
- Copy-paste HTML code
- Alternative markdown for GitHub
- Preset cycling button

Example: `https://roadmapper.rocketstack.co/html/facebook/react/ffffff/24292f`

### Local Development URLs

When running locally with `npm run run`, the Express server runs on port 5002:
- Landing page: `http://localhost:5002/`
- Roadmap: `http://localhost:5002/:owner/:repo/:bgColor/:textColor`
- View: `http://localhost:5002/view/:owner/:repo/:bgColor/:textColor`
- Embed: `http://localhost:5002/embed/:owner/:repo/:bgColor/:textColor`
- HTML: `http://localhost:5002/html/:owner/:repo/:bgColor/:textColor`

Example: `http://localhost:5002/rocketstack-matt/roadmapper/ffffff/24292f`

## Dependencies

- `express` (^4.22.1): HTTP server framework for local development
- `axios` (^1.13.4): HTTP client for GitHub API requests
- `dotenv` (latest): Environment variable management for local development

### Dev Dependencies

- `jest` (^30.2.0): Testing framework

## Important Files

- `roadmap.js`: Core SVG generation logic shared by all endpoints
- `api/index.js`: Landing page with marketing content and get started guide
- `api/roadmap.js`: SVG generator endpoint
- `api/view.js`: Interactive viewer page
- `api/embed.js`: Embeddable iframe page with image maps
- `api/html.js`: HTML code generator utility
- `server.js`: Local Express server for development
- `vercel.json`: Serverless deployment configuration
- `public/logo.svg`: Roadmapper logo
- `public/rocketstack-matt.png`: Avatar image
- `tests/`: Test suite directory (Jest)
- `README.md`: User-facing documentation
- `LICENSE`: Apache 2.0 license

## Development Notes

### GitHub API Authentication & Rate Limits

The service supports optional GitHub authentication via environment variable:

- **Unauthenticated**: 60 requests per hour per IP
- **Authenticated** (with `GITHUB_TOKEN`): 5,000 requests per hour

**Authentication Setup:**

- Local: Add `GITHUB_TOKEN=your_token` to `.env` file
- Production (Vercel): Add `GITHUB_TOKEN` environment variable in Vercel settings
- Token scope required: `public_repo` (read access to public repositories)
- The `fetchIssues()` function in `roadmap.js` automatically uses the token if available

The token is server-side only and never exposed to users. All users share the same rate limit pool (5,000/hour when authenticated).

### SVG Generation

The SVG is generated server-side and includes:
- Clickable links to GitHub issues (works in `<object>` tags and direct viewing)
- Hover effects on cards
- Responsive design (viewBox-based)
- Label color accent borders (extracted from GitHub API)
- Dynamic height based on number of issues in each column

### URL Pattern Matching

Each endpoint uses regex to extract URL parameters. The patterns consistently use:

```javascript
const match = url.match(/^\/endpoint\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/?/);
```

Where capture groups are: [1] = owner, [2] = repo, [3] = bgColor, [4] = textColor

**Fallback Routes:**

All endpoints support fallback routes that redirect to default colors when color parameters are omitted:

- `/:owner/:repo` → redirects to `/:owner/:repo/ffffff/24292f`
- `/view/:owner/:repo` → redirects to `/view/:owner/:repo/ffffff/24292f`
- `/embed/:owner/:repo` → redirects to `/embed/:owner/:repo/ffffff/24292f`
- `/html/:owner/:repo` → redirects to `/html/:owner/:repo/ffffff/24292f`

This provides backwards compatibility and a better user experience.

**Environment Detection:**

The `view.js`, `embed.js`, and `html.js` endpoints automatically detect the environment:

```javascript
const host = req.headers.host || 'roadmapper.rocketstack.co';
const protocol = host.includes('localhost') ? 'http' : 'https';
const baseUrl = `${protocol}://${host}`;
```

This ensures that locally running servers use `http://localhost:5002` URLs while production uses `https://roadmapper.rocketstack.co`.

### Theme Implementation

Theme switching for the HTML pages is implemented consistently:
1. CSS custom properties for colors
2. `[data-theme="dark"]` selector for dark mode overrides
3. JavaScript functions: `toggleTheme()`, `updateThemeIcon()` or `updatePresetButton()`
4. localStorage persistence with key `'theme'`
5. Default theme: `'light'`

**Preset Cycling (view.js, html.js):**

These pages include a preset cycling feature that switches between predefined color combinations. Each preset controls BOTH the roadmap SVG colors AND the page wrapper theme:

| Preset | Roadmap Colors  | Page Theme |
| ------ | --------------- | ---------- |
| Light  | `ffffff/24292f` | `light`    |
| Dark   | `0d1117/e6edf3` | `dark`     |
| GitHub | `f6f8fa/24292f` | `light`    |
| Navy   | `001f3f/ffffff` | `dark`     |
| Forest | `2c5f2d/ffffff` | `dark`     |

The preset button:

- Cycles through all 5 color combinations
- Updates the URL with new `bgColor` and `textColor` parameters
- Sets the page theme (`data-theme` attribute) to match the colors
- Saves the theme preference to localStorage
- Reloads the page with the new colors

## License

Apache 2.0 - See LICENSE file for details.

## Design System

### Color Palette

The project uses CSS custom properties for theming:

**Light Mode:**
- `--bg-primary`: #ffffff
- `--bg-secondary`: #f6f8fa
- `--text-primary`: #1a1a1a
- `--text-secondary`: #57606a
- `--accent-blue`: #1E88E5
- `--accent-teal`: #26A69A
- `--accent-green`: #66BB6A

**Dark Mode:**
- `--bg-primary`: #0d1117
- `--bg-secondary`: #161b22
- `--text-primary`: #e6edf3
- `--text-secondary`: #8b949e

### Branding

- **Logo**: `/public/logo.svg` - Used across all pages
- **Logo Layout**: Vertical (logo above "Roadmapper" text)
- **Logo Text**: Gradient text using blue → teal → green
- **Avatar**: `/public/rocketstack-matt.png` - Used in footer

### Theme Toggle

All web pages include a theme toggle button that:
- Switches between light and dark modes
- Persists preference in localStorage
- Updates icon (🌙 for light mode, ☀️ for dark mode)
- Applies CSS custom property changes

## Embedding Options

Users have three ways to embed roadmaps:

1. **GitHub README (Link to Viewer)**
   - Links to `/view/:owner/:repo/:bgColor/:textColor`
   - Necessary because GitHub strips interactive elements from embedded images
   - Markdown format: `[![Roadmap](https://roadmapper.rocketstack.co/owner/repo/ffffff/24292f)](https://roadmapper.rocketstack.co/view/owner/repo/ffffff/24292f)`

2. **Website/Documentation (iframe)**
   - Embeds `/embed/:owner/:repo/:bgColor/:textColor` via iframe
   - Provides directly clickable cards
   - Works on any site that supports iframes
   - Example: `<iframe src="https://roadmapper.rocketstack.co/embed/owner/repo/ffffff/24292f" width="100%" height="600"></iframe>`

3. **HTML Image Maps**
   - Generate via `/html/:owner/:repo/:bgColor/:textColor`
   - Provides copy-paste HTML with clickable regions
   - Advanced option for direct embedding

The landing page uses a tabbed interface to show these options clearly.

## Deployment

The project is deployed to Vercel with automatic deployments on push to `main` branch.

### Vercel Configuration (`vercel.json`)

Builds multiple serverless functions:
- `api/index.js` - Landing page
- `api/roadmap.js` - SVG generator
- `api/view.js` - Interactive viewer
- `api/embed.js` - Embeddable page
- `api/html.js` - HTML code generator
- `public/**` - Static files (logo, avatar)

### Routes

The routing is simplified - users don't need to include `/api/` in URLs:
- `/` → `api/index.js`
- `/:owner/:repo/:bgColor/:textColor` → `api/roadmap.js`
- `/view/:owner/:repo/:bgColor/:textColor` → `api/view.js`
- `/embed/:owner/:repo/:bgColor/:textColor` → `api/embed.js`
- `/html/:owner/:repo/:bgColor/:textColor` → `api/html.js`
- `/logo.svg` → `public/logo.svg`
- `/rocketstack-matt.png` → `public/rocketstack-matt.png`

### Custom Domain

Production: https://roadmapper.rocketstack.co (configured in Vercel)
