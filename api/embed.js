const { fetchIssues, groupIssues, buildGlobalLayout, COLUMN_HEADER_HEIGHT, CARD_SLOT_HEIGHT, GROUP_HEADER_HEIGHT } = require('../roadmap');

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
      now: groupIssues(issues.filter(issue => issue.labels.some(label => label.name === 'Roadmap: Now'))),
      next: groupIssues(issues.filter(issue => issue.labels.some(label => label.name === 'Roadmap: Next'))),
      later: groupIssues(issues.filter(issue => issue.labels.some(label => label.name === 'Roadmap: Later')))
    };

    const layout = buildGlobalLayout(columns);

    const imageUrl = `${baseUrl}/${owner}/${repo}/${bgColor}/${textColor}`;

    // Generate image map areas for each card using global layout coordinates
    const createGroupedAreas = (groupedData, columnIndex) => {
      const areas = [];

      if (!layout.hasGroups) {
        // Flat layout - no groups
        let y = COLUMN_HEADER_HEIGHT;
        groupedData.ungrouped.forEach(issue => {
          const xOffset = columnIndex * 380;
          const x1 = xOffset + 15;
          const y1 = y;
          const x2 = xOffset + 365;
          const y2 = y + 75;
          areas.push(`<area shape="rect" coords="${x1},${y1},${x2},${y2}" href="${issue.html_url}" alt="${issue.title}" target="_blank">`);
          y += CARD_SLOT_HEIGHT;
        });
      } else {
        // Global band positions
        for (const band of layout.bands) {
          const group = groupedData.groups.find(g => g.name === band.name);
          if (group) {
            let y = band.yStart + GROUP_HEADER_HEIGHT;
            group.issues.forEach(issue => {
              const xOffset = columnIndex * 380;
              const x1 = xOffset + 15;
              const y1 = y;
              const x2 = xOffset + 365;
              const y2 = y + 75;
              areas.push(`<area shape="rect" coords="${x1},${y1},${x2},${y2}" href="${issue.html_url}" alt="${issue.title}" target="_blank">`);
              y += CARD_SLOT_HEIGHT;
            });
          }
        }

        // Ungrouped band
        if (layout.ungroupedBand) {
          let y = layout.ungroupedBand.yStart + GROUP_HEADER_HEIGHT;
          groupedData.ungrouped.forEach(issue => {
            const xOffset = columnIndex * 380;
            const x1 = xOffset + 15;
            const y1 = y;
            const x2 = xOffset + 365;
            const y2 = y + 75;
            areas.push(`<area shape="rect" coords="${x1},${y1},${x2},${y2}" href="${issue.html_url}" alt="${issue.title}" target="_blank">`);
            y += CARD_SLOT_HEIGHT;
          });
        }
      }

      return areas.join('\n      ');
    };

    const mapAreas = `
      ${createGroupedAreas(columns.now, 0)}
      ${createGroupedAreas(columns.next, 1)}
      ${createGroupedAreas(columns.later, 2)}
    `;

    const gaId = process.env.GA_MEASUREMENT_ID;
    const gaSnippet = gaId ? `
  <script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');</script>` : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">${gaSnippet}
  <style>
    html, body { margin: 0; padding: 0; overflow: hidden; }
    img { max-width: 100%; height: auto; display: block; }
  </style>
  <script>
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  </script>
  <script defer src="/_vercel/insights/script.js"></script>
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
