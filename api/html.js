const { fetchIssues } = require('../roadmap');

module.exports = async (req, res) => {
  // Extract the path from the URL
  const url = req.url;
  const match = url.match(/\/html\/([^/]+)\/([^/]+)\/?([^/]*)/);

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

    const imageUrl = `https://roadmapper.rocketstack.co/${owner}/${repo}/${colorScheme}`;

    // Generate image map areas for each card
    const createAreas = (items, columnIndex) => {
      return items.map((issue, itemIndex) => {
        const xOffset = columnIndex * 380;
        const yOffset = 130 + (itemIndex * 95);

        // Card coordinates
        const x1 = xOffset + 15;
        const y1 = yOffset;
        const x2 = xOffset + 365;
        const y2 = yOffset + 75;

        return `    <area shape="rect" coords="${x1},${y1},${x2},${y2}" href="${issue.html_url}" alt="${issue.title.replace(/"/g, '&quot;')}" target="_blank">`;
      }).join('\n');
    };

    const mapAreas = `
${createAreas(columns.now, 0)}
${createAreas(columns.later, 1)}
${createAreas(columns.future, 2)}`;

    const htmlSnippet = `<img src="${imageUrl}" alt="${owner}/${repo} Roadmap" usemap="#roadmap-${owner}-${repo}" style="max-width: 100%;">
<map name="roadmap-${owner}-${repo}">
${mapAreas}
</map>

<!-- Click on any card to view the GitHub issue -->`;

    // Create a nice display page that shows both the preview and the code
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${owner}/${repo} - Roadmap HTML</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #f6f8fa;
      padding: 40px 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 40px;
      text-align: center;
    }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .header p { opacity: 0.9; }
    .section {
      padding: 40px;
      border-bottom: 1px solid #e1e4e8;
    }
    .section:last-child { border-bottom: none; }
    .section h2 {
      font-size: 20px;
      margin-bottom: 16px;
      color: #24292f;
    }
    .warning {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 6px;
      padding: 16px;
      margin: 20px 0;
      color: #856404;
    }
    .warning strong { color: #856404; }
    .code-block {
      background: #f6f8fa;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      padding: 16px;
      overflow-x: auto;
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 13px;
      line-height: 1.6;
    }
    .code-block code {
      color: #24292f;
      white-space: pre;
    }
    .copy-btn {
      background: #2da44e;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      margin-top: 12px;
    }
    .copy-btn:hover {
      background: #2c974b;
    }
    .preview-container {
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      padding: 20px;
      background: white;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>HTML Code for ${owner}/${repo}</h1>
      <p>Copy the HTML below to embed in your README</p>
    </div>

    <div class="section">
      <h2>Preview (Try clicking on the cards!)</h2>
      <div class="preview-container">
        ${htmlSnippet.replace(/<!-- .* -->/g, '')}
      </div>
    </div>

    <div class="section">
      <h2>HTML Code</h2>
      <div class="warning">
        <strong>⚠️ GitHub Limitation:</strong> GitHub's markdown renderer may not support HTML image maps for security reasons.
        If this doesn't work in your README, use the <a href="https://roadmapper.rocketstack.co/view/${owner}/${repo}/${colorScheme}" style="color: #0969da;">viewer link approach</a> instead.
      </div>
      <p style="margin-bottom: 12px;">Copy and paste this HTML into your README.md:</p>
      <div class="code-block"><code>${htmlSnippet.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></div>
      <button class="copy-btn" onclick="copyCode()">Copy to Clipboard</button>
    </div>

    <div class="section">
      <h2>Alternative: Link to Viewer Page</h2>
      <p style="margin-bottom: 12px; color: #57606a;">If the HTML image map doesn't work in GitHub, use this markdown instead:</p>
      <div class="code-block"><code>[![Roadmap](${imageUrl})](https://roadmapper.rocketstack.co/view/${owner}/${repo}/${colorScheme})</code></div>
    </div>
  </div>

  <script>
    function copyCode() {
      const code = \`${htmlSnippet.replace(/`/g, '\\`')}\`;
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = 'Copied!';
        btn.style.background = '#2c974b';
        setTimeout(() => {
          btn.textContent = 'Copy to Clipboard';
          btn.style.background = '#2da44e';
        }, 2000);
      });
    }
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).send('Error fetching GitHub issues: ' + error.message);
  }
};
