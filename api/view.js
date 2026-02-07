module.exports = async (req, res) => {
  // Extract the path from the URL
  const url = req.url;
  const match = url.match(/\/view\/([^/]+)\/([^/]+)\/?([^/]*)/);

  if (!match) {
    return res.status(400).send('Invalid URL format');
  }

  const owner = match[1];
  const repo = match[2];
  const colorScheme = match[3] || 'dark';

  const svgUrl = `https://roadmapper.rocketstack.co/${owner}/${repo}/${colorScheme}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${owner}/${repo} - Roadmap</title>
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
      --link-color: #0969da;
    }

    [data-theme="dark"] {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --text-primary: #e6edf3;
      --text-secondary: #8b949e;
      --border-color: #30363d;
      --link-color: #58a6ff;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: var(--bg-secondary);
      color: var(--text-primary);
      padding: 20px;
      min-height: 100vh;
      transition: background-color 0.3s ease, color 0.3s ease;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      margin-bottom: 30px;
      position: relative;
    }

    .logo-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      margin-bottom: 24px;
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
      top: 0;
      right: 0;
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
      background: var(--bg-primary);
    }

    .header h1 {
      font-size: 32px;
      color: var(--text-primary);
      margin-bottom: 8px;
    }

    .header p {
      color: var(--text-secondary);
      font-size: 16px;
    }

    .header a {
      color: var(--link-color);
      text-decoration: none;
    }

    .header a:hover {
      text-decoration: underline;
    }

    .roadmap-container {
      background: var(--bg-primary);
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      border: 1px solid var(--border-color);
    }

    object {
      width: 100%;
      display: block;
      min-height: 400px;
    }

    .footer {
      text-align: center;
      margin-top: 30px;
      padding: 20px;
      color: var(--text-secondary);
      font-size: 14px;
    }

    .footer a {
      color: var(--link-color);
      text-decoration: none;
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
      <h1>${owner}/${repo}</h1>
      <p>Project Roadmap · <a href="https://github.com/${owner}/${repo}" target="_blank">View on GitHub</a></p>
    </div>

    <div class="roadmap-container">
      <object data="${svgUrl}" type="image/svg+xml" width="100%" style="display: block;">
        <img src="${svgUrl}" alt="Roadmap" style="width: 100%;" />
      </object>
    </div>

    <div class="footer">
      <p>Powered by <a href="https://roadmapper.rocketstack.co" target="_blank">Roadmapper</a> · Click any item to view the issue on GitHub</p>
    </div>
  </div>

  <script>
    // Theme management
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    function toggleTheme() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeIcon(newTheme);
    }

    function updateThemeIcon(theme) {
      const icon = document.querySelector('.theme-icon');
      icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  </script>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
};
