# Roadmapper

A simple, elegant way to visualize your project roadmap using GitHub issues. Roadmapper automatically generates beautiful SVG roadmaps from your GitHub issues based on labels, making it easy to communicate your project's priorities and timeline.

## What is Roadmapper?

Roadmapper transforms your GitHub issues into a clean, three-column visual roadmap that's perfect for:
- Project README files
- Documentation sites
- Status pages
- Team dashboards

Simply label your GitHub issues with `Roadmap: Now`, `Roadmap: Later`, or `Roadmap: Future`, and Roadmapper does the rest.

## Live Example

Here's what this project's roadmap looks like:

[![Roadmap](https://roadmapper-theta.vercel.app/api/roadmap/rocketstack-matt/roadmapper/dark)](https://roadmapper-theta.vercel.app/view/rocketstack-matt/roadmapper/dark)

**[Click here to view the interactive roadmap](https://roadmapper-theta.vercel.app/view/rocketstack-matt/roadmapper/dark)** where you can click on items to view issues.

## How It Works

1. **Label your issues**: Add one of these labels to your GitHub issues:
   - `Roadmap: Now` - Top priority items you're working on right now
   - `Roadmap: Later` - Next priority items planned for soon
   - `Roadmap: Future` - Longer-term items under consideration

2. **Generate your roadmap**: Use the URL format:
   ```
   https://roadmapper-theta.vercel.app/api/roadmap/{owner}/{repo}/{colorScheme}
   ```

3. **Add to your README**: Link to the interactive viewer page where users can click on items:
   ```markdown
   [![Roadmap](https://roadmapper-theta.vercel.app/api/roadmap/owner/repo/dark)](https://roadmapper-theta.vercel.app/view/owner/repo/dark)
   ```

## Usage

### URL Format

```
https://roadmapper-theta.vercel.app/api/roadmap/{owner}/{repo}/{colorScheme}
```

**Parameters:**
- `owner` (required): GitHub repository owner/organization
- `repo` (required): GitHub repository name
- `colorScheme` (optional): Either `dark` or `light` (defaults to `dark`)

### Examples

**Dark theme (default):**
```
https://roadmapper-theta.vercel.app/api/roadmap/facebook/react/dark
```

**Light theme:**
```
https://roadmapper-theta.vercel.app/api/roadmap/facebook/react/light
```

### In Your README

**Interactive Viewer (Recommended):**

Link to the interactive viewer page where users can click on roadmap items:
```markdown
## Roadmap

[![Roadmap](https://roadmapper-theta.vercel.app/api/roadmap/your-username/your-repo/dark)](https://roadmapper-theta.vercel.app/view/your-username/your-repo/dark)

[View Interactive Roadmap →](https://roadmapper-theta.vercel.app/view/your-username/your-repo/dark)
```

**Static Image:**

If you just want to show a static roadmap image:
```markdown
## Roadmap

![Roadmap](https://roadmapper-theta.vercel.app/api/roadmap/your-username/your-repo/dark)
```

> **Note:** Due to GitHub's security restrictions, embedded SVGs cannot have clickable links. Use the interactive viewer link to allow users to click on roadmap items and view the issues.

## Color Schemes

### Dark Theme
- Best for dark backgrounds or standard GitHub README files
- Black headers with dark gray subheaders

### Light Theme
- Best for light backgrounds or custom documentation
- White headers with light gray subheaders

## Setup & Development

### Prerequisites
- Node.js 14 or higher
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
http://localhost:5002/roadmap/{owner}/{repo}/{colorScheme}
```

## Deployment

This project is configured for Vercel deployment out of the box:

1. Fork this repository
2. Import it to Vercel
3. Deploy

No environment variables or configuration needed!

## How Labels Work

Roadmapper looks for these exact label names on your GitHub issues:
- **`Roadmap: Now`**: Items appear in the green "Now" column
- **`Roadmap: Later`**: Items appear in the yellow "Later" column
- **`Roadmap: Future`**: Items appear in the gray "Future" column

Issues are automatically sorted by issue number within each column.

## Features

- ✨ Clean, modern SVG output
- 🎨 Dark and light color schemes
- 🔄 Real-time updates from GitHub issues
- 📱 Responsive design
- 🚀 Serverless deployment ready
- 🔒 No authentication required (uses public GitHub API)

## API Rate Limits

Roadmapper uses the public GitHub API, which has rate limits:
- **Unauthenticated requests**: 60 requests per hour per IP
- **Authenticated requests**: 5,000 requests per hour

For high-traffic use cases, consider caching the SVG output or implementing GitHub token authentication.

## License

ISC

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.
