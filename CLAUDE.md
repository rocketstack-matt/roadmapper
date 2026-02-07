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
- `generateRoadmapSVG(issues, colorScheme)`: Generates SVG content based on issue labels

**Label Color Extraction**: The service automatically extracts the actual color from GitHub labels and applies them as accent borders on roadmap cards. Each issue's label color is stored and used in the SVG generation.

### Issue Label Classification

The roadmap automatically categorizes issues into columns based on labels:
- **"Roadmap: Now"**: Top priority items currently being worked on
- **"Roadmap: Later"**: Next priority items planned for soon
- **"Roadmap: Future"**: Longer-term items under consideration

Issues are sorted by issue number and rendered in their respective columns.

### Color Schemes

The service supports two color schemes via URL parameter:
- `dark` (default): White background with dark text
- `light`: Light background theme

**Note**: Both the SVG roadmaps and the web pages (landing, viewer, embed, html) support light/dark mode with theme persistence via localStorage.

## Development Commands

Start the local Express server:
```bash
npm run run
```

The server runs on port 5002 by default (configurable via PORT environment variable).

## API Endpoints

All endpoints share the same URL parameters:
- `owner`: GitHub repository owner/organization
- `repo`: GitHub repository name
- `colorScheme`: Optional, either `dark` or `light` (defaults to `dark`)

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
GET /:owner/:repo/:colorScheme?
```
Returns the SVG roadmap image. This is the core endpoint that generates the visual roadmap.

Example: `https://roadmapper.rocketstack.co/facebook/react/dark`

#### 3. Interactive Viewer (`api/view.js`)
```
GET /view/:owner/:repo/:colorScheme?
```
A full HTML page that embeds the SVG roadmap with clickable links. Used as a workaround for GitHub's markdown restrictions (GitHub strips interactive elements from embedded SVGs).

Example: `https://roadmapper.rocketstack.co/view/facebook/react/dark`

#### 4. Embed Page (`api/embed.js`)
```
GET /embed/:owner/:repo/:colorScheme?
```
An iframe-embeddable page with HTML image maps for clickable roadmap cards. Designed for embedding on websites and documentation sites.

Example: `https://roadmapper.rocketstack.co/embed/facebook/react/dark`

#### 5. HTML Code Generator (`api/html.js`)
```
GET /html/:owner/:repo/:colorScheme?
```
A utility page that generates and displays HTML code with image maps for direct embedding. Shows:
- Preview of the clickable roadmap
- Copy-paste HTML code
- Alternative markdown for GitHub
- Light/dark mode theme toggle

Example: `https://roadmapper.rocketstack.co/html/facebook/react/dark`

### Local Development URLs

When running locally with `npm run run`, the Express server runs on port 5002:
- Landing page: `http://localhost:5002/`
- Roadmap: `http://localhost:5002/:owner/:repo/:colorScheme?`
- All other endpoints follow the same pattern as production

## Dependencies

- `express` (^4.22.1): HTTP server framework for local development
- `axios` (^1.13.4): HTTP client for GitHub API requests

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
- `README.md`: User-facing documentation
- `LICENSE`: Apache 2.0 license

## Development Notes

### GitHub API Rate Limits

The service uses the public GitHub API without authentication:
- **Unauthenticated**: 60 requests per hour per IP
- **Authenticated**: 5,000 requests per hour (not currently implemented)

For high-traffic scenarios, consider implementing caching or GitHub token authentication.

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
const match = url.match(/^\/endpoint\/([^/]+)\/([^/]+)\/?([^/]*)/);
```
Where capture groups are: [1] = owner, [2] = repo, [3] = colorScheme (optional)

### Theme Implementation

Theme switching is implemented consistently across all pages:
1. CSS custom properties for colors
2. `[data-theme="dark"]` selector for dark mode overrides
3. JavaScript functions: `toggleTheme()`, `updateThemeIcon()`
4. localStorage persistence with key `'theme'`
5. Default theme: `'light'`

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
   - Links to `/view/:owner/:repo/:colorScheme`
   - Necessary because GitHub strips interactive elements from embedded images
   - Markdown format: `[![Roadmap](URL)](viewer-URL)`

2. **Website/Documentation (iframe)**
   - Embeds `/embed/:owner/:repo/:colorScheme` via iframe
   - Provides directly clickable cards
   - Works on any site that supports iframes

3. **HTML Image Maps**
   - Generate via `/html/:owner/:repo/:colorScheme`
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
- `/:owner/:repo/:colorScheme?` → `api/roadmap.js`
- `/view/:owner/:repo/:colorScheme?` → `api/view.js`
- `/embed/:owner/:repo/:colorScheme?` → `api/embed.js`
- `/html/:owner/:repo/:colorScheme?` → `api/html.js`
- `/logo.svg` → `public/logo.svg`

### Custom Domain

Production: https://roadmapper.rocketstack.co (configured in Vercel)
