const { confirmRegistration } = require('../lib/keys');

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).setHeader('Content-Type', 'text/html');
    res.send(renderPage('Method Not Allowed', 'This endpoint only accepts GET requests.', false));
    return;
  }

  // Extract token from query string
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    res.status(400).setHeader('Content-Type', 'text/html');
    res.send(renderPage('Missing Token', 'No confirmation token provided.', false));
    return;
  }

  const result = await confirmRegistration(token);

  if (!result.success) {
    res.status(400).setHeader('Content-Type', 'text/html');
    res.send(renderPage('Confirmation Failed', result.reason, false));
    return;
  }

  res.status(200).setHeader('Content-Type', 'text/html');
  res.send(renderPage(
    'Email Confirmed!',
    `Your API key for <strong>${result.owner}/${result.repo}</strong> is now active. You can close this page.`,
    true
  ));
};

const renderPage = (title, message, success) => {
  const bgColor = success ? '#d4edda' : '#f8d7da';
  const textColor = success ? '#155724' : '#721c24';
  const icon = success ? '&#10003;' : '&#10007;';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Roadmapper</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f6f8fa;
      color: #24292f;
    }
    .container {
      text-align: center;
      max-width: 500px;
      padding: 40px;
    }
    .icon {
      font-size: 48px;
      width: 80px;
      height: 80px;
      line-height: 80px;
      border-radius: 50%;
      background: ${bgColor};
      color: ${textColor};
      margin: 0 auto 24px;
    }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { color: #57606a; line-height: 1.6; }
    a { color: #0969da; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p style="margin-top: 24px;"><a href="/">Back to Roadmapper</a></p>
  </div>
</body>
</html>`;
};

module.exports = handler;
