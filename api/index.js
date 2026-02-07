module.exports = async (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Roadmapper - GitHub Issue Roadmaps Made Simple</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #24292f;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 60px 40px;
      text-align: center;
    }

    .header h1 {
      font-size: 48px;
      font-weight: 800;
      margin-bottom: 16px;
      letter-spacing: -1px;
    }

    .header p {
      font-size: 20px;
      opacity: 0.95;
      max-width: 600px;
      margin: 0 auto;
    }

    .content {
      padding: 60px 40px;
    }

    .section {
      margin-bottom: 50px;
    }

    .section h2 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 20px;
      color: #24292f;
    }

    .section h3 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 12px;
      margin-top: 24px;
      color: #57606a;
    }

    .section p {
      font-size: 16px;
      color: #57606a;
      margin-bottom: 16px;
    }

    .example-image {
      width: 100%;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      margin: 24px 0;
      border: 1px solid #e1e4e8;
    }

    .code-block {
      background: #f6f8fa;
      border: 1px solid #e1e4e8;
      border-radius: 8px;
      padding: 20px;
      margin: 16px 0;
      overflow-x: auto;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 14px;
    }

    .code-block code {
      color: #24292f;
      white-space: pre;
    }

    .url-pattern {
      background: #667eea;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 16px;
      margin: 16px 0;
      word-break: break-all;
    }

    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 24px;
      margin: 32px 0;
    }

    .feature {
      padding: 24px;
      border: 2px solid #e1e4e8;
      border-radius: 8px;
      transition: all 0.3s ease;
    }

    .feature:hover {
      border-color: #667eea;
      transform: translateY(-4px);
      box-shadow: 0 8px 16px rgba(102, 126, 234, 0.2);
    }

    .feature h3 {
      font-size: 18px;
      margin: 0 0 8px 0;
      color: #24292f;
    }

    .feature p {
      font-size: 14px;
      margin: 0;
      color: #57606a;
    }

    .label-examples {
      display: flex;
      gap: 16px;
      margin: 24px 0;
      flex-wrap: wrap;
    }

    .label {
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 14px;
      display: inline-block;
    }

    .label-now {
      background: #2da44e;
      color: white;
    }

    .label-later {
      background: #fb8500;
      color: white;
    }

    .label-future {
      background: #8b949e;
      color: white;
    }

    .cta {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      border-radius: 12px;
      text-align: center;
      margin-top: 40px;
    }

    .cta h2 {
      color: white;
      margin-bottom: 16px;
    }

    .cta a {
      display: inline-block;
      background: white;
      color: #667eea;
      padding: 12px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      margin-top: 16px;
      transition: transform 0.2s ease;
    }

    .cta a:hover {
      transform: scale(1.05);
    }

    .footer {
      text-align: center;
      padding: 40px;
      color: #57606a;
      font-size: 14px;
      border-top: 1px solid #e1e4e8;
    }

    .footer a {
      color: #667eea;
      text-decoration: none;
    }

    .footer a:hover {
      text-decoration: underline;
    }

    @media (max-width: 768px) {
      .header {
        padding: 40px 20px;
      }

      .header h1 {
        font-size: 36px;
      }

      .content {
        padding: 40px 20px;
      }

      .section h2 {
        font-size: 24px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🗺️ Roadmapper</h1>
      <p>Transform your GitHub issues into beautiful, visual roadmaps. Simple, elegant, and effortless.</p>
    </div>

    <div class="content">
      <div class="section">
        <h2>How It Works</h2>
        <p>Roadmapper automatically generates clean SVG roadmaps from your GitHub issues. Just label your issues and embed the roadmap anywhere.</p>

        <div class="features">
          <div class="feature">
            <h3>🏷️ Label Issues</h3>
            <p>Add Roadmap: Now, Later, or Future labels to your GitHub issues</p>
          </div>
          <div class="feature">
            <h3>🎨 Get Your Roadmap</h3>
            <p>Use our simple URL format to generate your roadmap SVG</p>
          </div>
          <div class="feature">
            <h3>📝 Embed Anywhere</h3>
            <p>Add the roadmap to your README, docs, or website</p>
          </div>
        </div>
      </div>

      <div class="section">
        <h2>Usage</h2>

        <h3>1. Create GitHub Labels</h3>
        <p>Add these labels to your GitHub repository:</p>
        <div class="label-examples">
          <span class="label label-now">Roadmap: Now</span>
          <span class="label label-later">Roadmap: Later</span>
          <span class="label label-future">Roadmap: Future</span>
        </div>

        <h3>2. Label Your Issues</h3>
        <p>Apply the labels to your issues based on priority and timeline.</p>

        <h3>3. Generate Your Roadmap</h3>
        <p>Use this URL format:</p>
        <div class="url-pattern">
          https://roadmapper.rocketstack.co/api/roadmap/{owner}/{repo}/{colorScheme}
        </div>

        <h3>Parameters</h3>
        <ul style="margin-left: 20px; color: #57606a;">
          <li><strong>owner</strong> - GitHub repository owner or organization</li>
          <li><strong>repo</strong> - Repository name</li>
          <li><strong>colorScheme</strong> - Optional: "dark" (default) or "light"</li>
        </ul>
      </div>

      <div class="section">
        <h2>Examples</h2>

        <h3>Dark Theme (Default)</h3>
        <div class="code-block"><code>![Roadmap](https://roadmapper.rocketstack.co/api/roadmap/facebook/react/dark)</code></div>

        <h3>Light Theme</h3>
        <div class="code-block"><code>![Roadmap](https://roadmapper.rocketstack.co/api/roadmap/your-username/your-repo/light)</code></div>

        <h3>Interactive Viewer (Recommended)</h3>
        <p>Link to the interactive viewer page where users can click on roadmap items:</p>
        <div class="code-block"><code>[![Roadmap](https://roadmapper.rocketstack.co/api/roadmap/your-username/your-repo/dark)](https://roadmapper.rocketstack.co/view/your-username/your-repo/dark)</code></div>

        <h3>Static Image</h3>
        <p>If you just want to display a static roadmap image:</p>
        <div class="code-block"><code>![Roadmap](https://roadmapper.rocketstack.co/api/roadmap/your-username/your-repo/dark)</code></div>

        <p style="margin-top: 16px; padding: 16px; background: #fff3cd; border-radius: 6px; font-size: 14px;">
          <strong>Note:</strong> Due to GitHub's security restrictions, embedded SVGs cannot have clickable links. Use the interactive viewer link to allow users to click on roadmap items.
        </p>

        <h3>Live Example</h3>
        <p>Here's what a roadmap looks like:</p>
        <img class="example-image" src="https://roadmapper.rocketstack.co/api/roadmap/rocketstack-matt/roadmapper/dark" alt="Example Roadmap" />
      </div>

      <div class="section">
        <h2>Features</h2>
        <ul style="margin-left: 20px; color: #57606a; line-height: 1.8;">
          <li>✨ Clean, modern SVG design</li>
          <li>🎨 Dark and light color schemes</li>
          <li>🔄 Real-time updates from GitHub</li>
          <li>📱 Responsive and scalable</li>
          <li>🚀 Serverless and fast</li>
          <li>🔓 No authentication required</li>
          <li>💯 Free and open source</li>
        </ul>
      </div>

      <div class="cta">
        <h2>Ready to Get Started?</h2>
        <p style="color: rgba(255, 255, 255, 0.9);">Create your first roadmap in minutes</p>
        <a href="https://github.com/rocketstack-matt/roadmapper" target="_blank">View on GitHub →</a>
      </div>
    </div>

    <div class="footer">
      <p>Made with ❤️ by <a href="https://github.com/rocketstack-matt" target="_blank">Matthew Bain</a></p>
      <p style="margin-top: 8px;">
        <a href="https://github.com/rocketstack-matt/roadmapper" target="_blank">GitHub</a> ·
        <a href="https://github.com/rocketstack-matt/roadmapper/issues" target="_blank">Issues</a> ·
        <a href="https://github.com/rocketstack-matt/roadmapper/blob/main/LICENSE" target="_blank">License</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
};
