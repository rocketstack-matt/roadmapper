const { generateRoadmapSVG, fetchIssues } = require('../roadmap');

const { withMiddleware } = require('../lib/middleware');

const handler = async (req, res) => {
  // Extract the path from the URL
  const url = req.url;
  let match = url.match(/\/embed\/([^/?]+)\/([^/?]+)\/([^/?]+)\/([^/?]+)\/?/);

  // If no match, check for 2-parameter format and redirect to defaults
  if (!match) {
    const fallbackMatch = url.match(/\/embed\/([^/?]+)\/([^/?]+)\/?$/);
    if (fallbackMatch) {
      const owner = fallbackMatch[1];
      const repo = fallbackMatch[2];
      return res.redirect(301, `/embed/${owner}/${repo}/ffffff/24292f`);
    }
    return res.status(400).send('Invalid URL format. Expected: /embed/:owner/:repo/:bgColor/:textColor');
  }

  const owner = match[1];
  const repo = match[2];
  const bgColor = match[3];
  const textColor = match[4];

  // Detect environment: use localhost for local development, production URL otherwise
  const host = req.headers.host || 'roadmapper.rocketstack.co';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  try {
    const issues = await fetchIssues(owner, repo, req.cacheTtl);

    // Sort issues by number
    issues.sort((a, b) => a.number - b.number);

    const columns = {
      now: issues.filter(issue => issue.labels.some(label => label.name === 'Roadmap: Now')),
      next: issues.filter(issue => issue.labels.some(label => label.name === 'Roadmap: Next')),
      later: issues.filter(issue => issue.labels.some(label => label.name === 'Roadmap: Later'))
    };

    const maxItemsCount = Math.max(columns.now.length, columns.next.length, columns.later.length);
    const svgHeight = 140 + (maxItemsCount * 95);
    const svgWidth = 1140;

    const imageUrl = `${baseUrl}/${owner}/${repo}/${bgColor}/${textColor}`;

    // Generate image map areas for each card
    let mapAreas = '';

    // Helper function to create area for each column
    const createAreas = (items, columnIndex) => {
      return items.map((issue, itemIndex) => {
        const xOffset = columnIndex * 380;
        const yOffset = 130 + (itemIndex * 95);

        // Card coordinates: x=15, y=yOffset, width=350, height=75 (relative to column)
        const x1 = xOffset + 15;
        const y1 = yOffset;
        const x2 = xOffset + 365; // 15 + 350
        const y2 = yOffset + 75;

        return `<area shape="rect" coords="${x1},${y1},${x2},${y2}" href="${issue.html_url}" alt="${issue.title}" target="_blank">`;
      }).join('\n      ');
    };

    mapAreas = `
      ${createAreas(columns.now, 0)}
      ${createAreas(columns.next, 1)}
      ${createAreas(columns.later, 2)}
    `;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; }
    img { max-width: 100%; height: auto; display: block; }
  </style>
</head>
<body>
  <img src="${imageUrl}" alt="Roadmap" usemap="#roadmap" style="width: 100%;">
  <map name="roadmap">
    ${mapAreas}
  </map>
  <script>
    var img = document.querySelector('img');
    function sendSize() {
      if (window.parent !== window && img.offsetHeight > 0) {
        window.parent.postMessage({
          type: 'roadmap-resize',
          height: img.offsetHeight
        }, '*');
      }
    }
    if (img.complete) sendSize();
    else img.addEventListener('load', sendSize);
    window.addEventListener('resize', sendSize);
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).send('Error fetching GitHub issues');
  }
};

module.exports = withMiddleware(handler);
