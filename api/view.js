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

  const svgUrl = `https://roadmapper.rocketstack.co/api/roadmap/${owner}/${repo}/${colorScheme}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${owner}/${repo} - Roadmap</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: ${colorScheme === 'light' ? '#f6f8fa' : '#ffffff'};
      padding: 20px;
      min-height: 100vh;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      margin-bottom: 30px;
    }

    .header h1 {
      font-size: 32px;
      color: #24292f;
      margin-bottom: 8px;
    }

    .header p {
      color: #57606a;
      font-size: 16px;
    }

    .header a {
      color: #0969da;
      text-decoration: none;
    }

    .header a:hover {
      text-decoration: underline;
    }

    .roadmap-container {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
      color: #57606a;
      font-size: 14px;
    }

    .footer a {
      color: #0969da;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
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
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
};
