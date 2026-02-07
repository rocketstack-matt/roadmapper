# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Roadmapper is a Node.js service that generates dynamic SVG roadmap visualizations from GitHub issues. It reads GitHub issues with specific labels and renders them as a three-column roadmap (Now/Later/Future).

## Architecture

The project supports two deployment modes:
1. **Serverless** (production): Uses `api/roadmap.js` as a serverless function
2. **Express Server** (local development): Uses `server.js` with Express routing

Both deployment modes share the same core logic in `roadmap.js`:
- `fetchIssues(owner, repo)`: Fetches GitHub issues via the GitHub API
- `generateRoadmapSVG(issues, colorScheme)`: Generates SVG content based on issue labels

### Issue Label Classification

The roadmap automatically categorizes issues into columns based on labels:
- **"Roadmap: Now"**: Top priority items currently being worked on
- **"Roadmap: Later"**: Next priority items planned for soon
- **"Roadmap: Future"**: Longer-term items under consideration

Issues are sorted by issue number and rendered in their respective columns.

### Color Schemes

The service supports two color schemes via URL parameter:
- `dark` (default): Black headers, dark gray subheaders
- `light`: White headers, light gray subheaders

## Development Commands

Start the local Express server:
```bash
npm run run
```

The server runs on port 5002 by default (configurable via PORT environment variable).

## API Endpoints

### Local Development (Express)
```
GET /roadmap/:owner/:repo/:colorScheme?
```

### Production (Serverless)
```
GET /:owner/:repo/:colorScheme?
```

Parameters:
- `owner`: GitHub repository owner
- `repo`: GitHub repository name
- `colorScheme`: Optional, either `dark` or `light` (defaults to `dark`)

Example: `/api/roadmap/facebook/react/light`

## Dependencies

- `express`: HTTP server framework
- `axios`: HTTP client for GitHub API requests

## Deployment

The project is configured for serverless deployment via `vercel.json`, which:
- Builds `api/roadmap.js` as a serverless function using `@vercel/node`
- Routes requests to the appropriate serverless functions
