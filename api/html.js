const { fetchIssues } = require('../roadmap');

module.exports = async (req, res) => {
  // Extract the path from the URL
  const url = req.url;
  let match = url.match(/\/html\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/?/);

  // If no match, check for 2-parameter format and redirect to defaults
  if (!match) {
    const fallbackMatch = url.match(/\/html\/([^/]+)\/([^/]+)\/?$/);
    if (fallbackMatch) {
      const owner = fallbackMatch[1];
      const repo = fallbackMatch[2];
      return res.redirect(301, `/html/${owner}/${repo}/ffffff/24292f`);
    }
    return res.status(400).send('Invalid URL format. Expected: /html/:owner/:repo/:bgColor/:textColor');
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

    const imageUrl = `${baseUrl}/${owner}/${repo}/${bgColor}/${textColor}`;

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
    :root {
      --bg-primary: #ffffff;
      --bg-secondary: #f6f8fa;
      --text-primary: #1a1a1a;
      --text-secondary: #57606a;
      --border-color: #e1e4e8;
      --accent-blue: #1E88E5;
      --accent-teal: #26A69A;
      --accent-green: #66BB6A;
      --code-bg: #f6f8fa;
    }

    [data-theme="dark"] {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --text-primary: #e6edf3;
      --text-secondary: #8b949e;
      --border-color: #30363d;
      --code-bg: #161b22;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: var(--bg-secondary);
      color: var(--text-primary);
      padding: 40px 20px;
      transition: background-color 0.3s ease, color 0.3s ease;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: var(--bg-primary);
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: var(--bg-primary);
      border-bottom: 1px solid var(--border-color);
      padding: 30px 40px;
      text-align: center;
      position: relative;
    }
    .logo-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .logo-container img {
      height: 35px;
      width: auto;
    }
    .logo-text {
      font-size: 20px;
      font-weight: 600;
      background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-teal) 50%, var(--accent-green) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .theme-toggle {
      position: absolute;
      top: 30px;
      right: 40px;
      background: none;
      border: 1px solid var(--border-color);
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      color: var(--text-primary);
      transition: all 0.3s ease;
    }
    .theme-toggle:hover {
      background: var(--bg-secondary);
    }
    .header h1 {
      font-size: 24px;
      margin-bottom: 8px;
      color: var(--text-primary);
    }
    .header p {
      color: var(--text-secondary);
    }
    .section {
      padding: 40px;
      border-bottom: 1px solid var(--border-color);
    }
    .section:last-child { border-bottom: none; }
    .section h2 {
      font-size: 20px;
      margin-bottom: 16px;
      color: var(--text-primary);
    }
    .warning {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 6px;
      padding: 16px;
      margin: 20px 0;
      color: #856404;
    }
    [data-theme="dark"] .warning {
      background: #3d3000;
      border-color: #8a6d00;
      color: #ffc107;
    }
    .warning strong { color: inherit; }
    .warning a {
      color: #0969da;
      text-decoration: none;
    }
    [data-theme="dark"] .warning a {
      color: #58a6ff;
    }
    .warning a:hover {
      text-decoration: underline;
    }
    .code-block {
      background: var(--code-bg);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 16px;
      overflow-x: auto;
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-size: 13px;
      line-height: 1.6;
    }
    .code-block code {
      color: var(--text-primary);
      white-space: pre;
    }
    .copy-btn {
      background: var(--accent-green);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      margin-top: 12px;
      transition: all 0.3s ease;
    }
    .copy-btn:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }
    .preview-container {
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 20px;
      background: var(--bg-primary);
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
    }
    p {
      color: var(--text-secondary);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <button class="theme-toggle" onclick="toggleTheme()">
        <span class="theme-icon">🌙</span>
      </button>
      <div class="logo-container">
        <img src="/logo.svg" alt="Roadmapper Logo">
        <div class="logo-text">Roadmapper</div>
      </div>
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
        If this doesn't work in your README, use the <a href="${baseUrl}/view/${owner}/${repo}/${bgColor}/${textColor}" style="color: #0969da;">viewer link approach</a> instead.
      </div>
      <p style="margin-bottom: 12px;">Copy and paste this HTML into your README.md:</p>
      <div class="code-block"><code>${htmlSnippet.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></div>
      <button class="copy-btn" onclick="copyCode()">Copy to Clipboard</button>
    </div>

    <div class="section">
      <h2>Alternative: Link to Viewer Page</h2>
      <p style="margin-bottom: 12px; color: #57606a;">If the HTML image map doesn't work in GitHub, use this markdown instead:</p>
      <div class="code-block"><code>[![Roadmap](${imageUrl})](${baseUrl}/view/${owner}/${repo}/${bgColor}/${textColor})</code></div>
    </div>
  </div>

  <script>
    // Color presets for cycling (with page theme mapping)
    const COLOR_PRESETS = [
      { name: 'Light', bg: 'ffffff', text: '24292f', theme: 'light' },
      { name: 'Dark', bg: '0d1117', text: 'e6edf3', theme: 'dark' },
      { name: 'GitHub', bg: 'f6f8fa', text: '24292f', theme: 'light' },
      { name: 'Navy', bg: '001f3f', text: 'ffffff', theme: 'dark' },
      { name: 'Forest', bg: '2c5f2d', text: 'ffffff', theme: 'dark' }
    ];

    // Determine current preset index based on URL colors
    const currentBg = '${bgColor}';
    const currentText = '${textColor}';
    let currentPresetIndex = COLOR_PRESETS.findIndex(p => p.bg === currentBg && p.text === currentText);
    if (currentPresetIndex === -1) currentPresetIndex = 0;

    // Set page theme based on current preset
    const currentPreset = COLOR_PRESETS[currentPresetIndex];
    document.documentElement.setAttribute('data-theme', currentPreset.theme);
    localStorage.setItem('theme', currentPreset.theme);

    updatePresetButton();

    function toggleTheme() {
      currentPresetIndex = (currentPresetIndex + 1) % COLOR_PRESETS.length;
      const preset = COLOR_PRESETS[currentPresetIndex];

      // Save theme preference
      localStorage.setItem('theme', preset.theme);

      // Update URL and reload
      // Path structure: ['', 'html', 'owner', 'repo', 'bgColor', 'textColor']
      const path = window.location.pathname.split('/');
      path[4] = preset.bg;   // bgColor is at index 4
      path[5] = preset.text;  // textColor is at index 5
      window.location.pathname = path.join('/');
    }

    function updatePresetButton() {
      const preset = COLOR_PRESETS[currentPresetIndex];
      const icon = document.querySelector('.theme-icon');
      icon.textContent = preset.name;
    }

    function copyCode() {
      const code = \`${htmlSnippet.replace(/`/g, '\\`')}\`;
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = 'Copy to Clipboard';
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
