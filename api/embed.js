const { generateRoadmapSVG, fetchIssues } = require('../roadmap');

module.exports = async (req, res) => {
  // Extract the path from the URL
  const url = req.url;
  const match = url.match(/\/embed\/([^/]+)\/([^/]+)\/?([^/]*)/);

  if (!match) {
    return res.status(400).send('Invalid URL format');
  }

  const owner = match[1];
  const repo = match[2];
  const colorScheme = match[3] || 'dark';

  try {
    const issues = await fetchIssues(owner, repo);

    // Sort issues by number
    issues.sort((a, b) => a.number - b.number);

    const columns = {
      now: issues.filter(issue => issue.labels.some(label => label.name === 'Roadmap: Now')),
      later: issues.filter(issue => issue.labels.some(label => label.name === 'Roadmap: Later')),
      future: issues.filter(issue => issue.labels.some(label => label.name === 'Roadmap: Future'))
    };

    const maxItemsCount = Math.max(columns.now.length, columns.later.length, columns.future.length);
    const svgHeight = 140 + (maxItemsCount * 95);
    const svgWidth = 1140;

    const imageUrl = `https://roadmapper.rocketstack.co/${owner}/${repo}/${colorScheme}`;

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
      ${createAreas(columns.later, 1)}
      ${createAreas(columns.future, 2)}
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
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).send('Error fetching GitHub issues');
  }
};
