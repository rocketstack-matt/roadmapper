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

    :root {
      --bg-primary: #ffffff;
      --bg-secondary: #f8f9fa;
      --bg-tertiary: #ffffff;
      --text-primary: #1a1a1a;
      --text-secondary: #666666;
      --text-tertiary: #999999;
      --border-color: #e0e0e0;
      --accent-blue: #1E88E5;
      --accent-teal: #26A69A;
      --accent-green: #66BB6A;
      --shadow: rgba(0, 0, 0, 0.1);
      --code-bg: #f5f5f5;
    }

    [data-theme="dark"] {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-tertiary: #1c2128;
      --text-primary: #e6edf3;
      --text-secondary: #9198a1;
      --text-tertiary: #6e7681;
      --border-color: #30363d;
      --shadow: rgba(0, 0, 0, 0.3);
      --code-bg: #161b22;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: var(--text-primary);
      background: var(--bg-primary);
      transition: background-color 0.3s ease, color 0.3s ease;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }

    /* Header */
    .header {
      padding: 40px 0;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-primary);
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(10px);
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .logo {
      height: 50px;
      width: auto;
    }

    .logo-text {
      font-size: 28px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .theme-toggle {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 10px 16px;
      cursor: pointer;
      font-size: 14px;
      color: var(--text-primary);
      transition: all 0.2s ease;
    }

    .theme-toggle:hover {
      background: var(--bg-tertiary);
      transform: translateY(-1px);
    }

    /* Hero */
    .hero {
      text-align: center;
      padding: 80px 0 60px;
    }

    .hero h1 {
      font-size: 56px;
      font-weight: 800;
      margin-bottom: 20px;
      letter-spacing: -1px;
      background: linear-gradient(135deg, var(--accent-blue), var(--accent-teal), var(--accent-green));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .hero p {
      font-size: 20px;
      color: var(--text-secondary);
      max-width: 600px;
      margin: 0 auto 40px;
    }

    .cta-buttons {
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .btn {
      padding: 14px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      border: none;
      cursor: pointer;
      display: inline-block;
    }

    .btn-primary {
      background: linear-gradient(135deg, var(--accent-blue), var(--accent-teal));
      color: white;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 16px var(--shadow);
    }

    .btn-secondary {
      background: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
    }

    .btn-secondary:hover {
      background: var(--bg-tertiary);
    }

    /* Section */
    .section {
      padding: 60px 0;
    }

    .section-title {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 16px;
      text-align: center;
    }

    .section-description {
      font-size: 18px;
      color: var(--text-secondary);
      text-align: center;
      max-width: 700px;
      margin: 0 auto 48px;
    }

    /* Features Grid */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 32px;
      margin-top: 48px;
    }

    .feature-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 32px;
      transition: all 0.3s ease;
    }

    .feature-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 24px var(--shadow);
      border-color: var(--accent-teal);
    }

    .feature-icon {
      font-size: 32px;
      margin-bottom: 16px;
    }

    .feature-title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--text-primary);
    }

    .feature-description {
      color: var(--text-secondary);
      line-height: 1.6;
    }

    /* Example */
    .example-container {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 32px;
      margin-top: 48px;
    }

    .example-container img {
      width: 100%;
      height: auto;
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }

    /* Code Block */
    .code-section {
      margin-top: 48px;
    }

    .code-block {
      background: var(--code-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 24px;
      overflow-x: auto;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 14px;
      line-height: 1.8;
      color: var(--text-primary);
      margin: 24px 0;
    }

    .code-block code {
      white-space: pre;
    }

    /* Steps */
    .steps {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 32px;
      margin-top: 48px;
    }

    .step {
      text-align: center;
      padding: 24px;
    }

    .step-number {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent-blue), var(--accent-teal));
      color: white;
      font-size: 24px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }

    .step-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--text-primary);
    }

    .step-description {
      color: var(--text-secondary);
      font-size: 14px;
    }

    /* Footer */
    .footer {
      border-top: 1px solid var(--border-color);
      padding: 48px 0;
      margin-top: 80px;
      text-align: center;
      color: var(--text-secondary);
    }

    .footer a {
      color: var(--accent-teal);
      text-decoration: none;
    }

    .footer a:hover {
      text-decoration: underline;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .hero h1 {
        font-size: 36px;
      }

      .hero p {
        font-size: 18px;
      }

      .section-title {
        font-size: 28px;
      }

      .logo-text {
        display: none;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <header class="header">
    <div class="container">
      <div class="header-content">
        <div class="logo-container">
          <svg class="logo" viewBox="0 0 800 500" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="315" cy="195" r="45" fill="var(--bg-primary)"/>
            <circle cx="315" cy="195" r="35" fill="var(--bg-primary)"/>
            <path d="M 315 160 A 35 35 0 0 1 315 230 A 35 35 0 0 1 315 160" fill="none" stroke="#1E88E5" stroke-width="20"/>
            <line x1="350" y1="195" x2="450" y2="195" stroke="url(#gradient1)" stroke-width="18" stroke-linecap="round"/>
            <circle cx="495" cy="195" r="45" fill="var(--bg-primary)"/>
            <circle cx="495" cy="195" r="35" fill="var(--bg-primary)"/>
            <path d="M 495 160 A 35 35 0 0 1 495 230 A 35 35 0 0 1 495 160" fill="none" stroke="#26A69A" stroke-width="20"/>
            <line x1="530" y1="195" x2="630" y2="195" stroke="url(#gradient2)" stroke-width="18" stroke-linecap="round"/>
            <circle cx="655" cy="195" r="45" fill="var(--bg-primary)"/>
            <circle cx="655" cy="195" r="35" fill="var(--bg-primary)"/>
            <path d="M 655 160 A 35 35 0 0 1 655 230 A 35 35 0 0 1 655 160" fill="none" stroke="#66BB6A" stroke-width="20"/>
            <path d="M 700 195 L 775 195 M 745 165 L 775 195 L 745 225" stroke="#66BB6A" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
            <defs>
              <linearGradient id="gradient1" x1="350" y1="195" x2="450" y2="195">
                <stop offset="0%" stop-color="#1E88E5"/>
                <stop offset="100%" stop-color="#26A69A"/>
              </linearGradient>
              <linearGradient id="gradient2" x1="530" y1="195" x2="630" y2="195">
                <stop offset="0%" stop-color="#26A69A"/>
                <stop offset="100%" stop-color="#66BB6A"/>
              </linearGradient>
            </defs>
          </svg>
          <span class="logo-text">Roadmapper</span>
        </div>
        <button class="theme-toggle" onclick="toggleTheme()">
          <span id="theme-icon">🌙</span> <span id="theme-text">Dark Mode</span>
        </button>
      </div>
    </div>
  </header>

  <!-- Hero -->
  <section class="hero">
    <div class="container">
      <h1>GitHub Issue Roadmaps Made Simple</h1>
      <p>Transform your GitHub issues into beautiful, visual roadmaps. Label your issues, generate your roadmap, and share it anywhere.</p>
      <div class="cta-buttons">
        <a href="#get-started" class="btn btn-primary">Get Started</a>
        <a href="https://github.com/rocketstack-matt/roadmapper" target="_blank" class="btn btn-secondary">View on GitHub</a>
      </div>
    </div>
  </section>

  <!-- How It Works -->
  <section class="section">
    <div class="container">
      <h2 class="section-title">How It Works</h2>
      <p class="section-description">Create visual roadmaps from your GitHub issues in three simple steps</p>

      <div class="steps">
        <div class="step">
          <div class="step-number">1</div>
          <h3 class="step-title">Label Your Issues</h3>
          <p class="step-description">Add "Roadmap: Now", "Roadmap: Later", or "Roadmap: Future" labels to your GitHub issues</p>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <h3 class="step-title">Generate Your Roadmap</h3>
          <p class="step-description">Use our simple URL format with your repository details</p>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <h3 class="step-title">Share Anywhere</h3>
          <p class="step-description">Embed in your README, docs, or website - it updates automatically</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Example -->
  <section class="section" style="background: var(--bg-secondary);">
    <div class="container">
      <h2 class="section-title">Live Example</h2>
      <p class="section-description">Here's what a roadmap looks like in action</p>
      <div class="example-container">
        <img src="https://roadmapper.rocketstack.co/api/roadmap/rocketstack-matt/roadmapper/dark" alt="Example Roadmap" />
      </div>
    </div>
  </section>

  <!-- Get Started -->
  <section class="section" id="get-started">
    <div class="container">
      <h2 class="section-title">Get Started</h2>
      <p class="section-description">Add this to your README.md:</p>

      <div class="code-block"><code>[![Roadmap](https://roadmapper.rocketstack.co/api/roadmap/your-username/your-repo/dark)](https://roadmapper.rocketstack.co/view/your-username/your-repo/dark)

> Click the roadmap to view the interactive version with clickable cards.</code></div>

      <h3 style="margin-top: 48px; margin-bottom: 24px; text-align: center; font-size: 24px;">URL Format</h3>
      <div class="code-block"><code>https://roadmapper.rocketstack.co/api/roadmap/{owner}/{repo}/{colorScheme}</code></div>

      <p style="text-align: center; color: var(--text-secondary); margin-top: 16px;">
        <strong>owner</strong>: GitHub username or organization<br>
        <strong>repo</strong>: Repository name<br>
        <strong>colorScheme</strong>: "dark" or "light" (optional, defaults to dark)
      </p>
    </div>
  </section>

  <!-- Features -->
  <section class="section" style="background: var(--bg-secondary);">
    <div class="container">
      <h2 class="section-title">Features</h2>

      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">✨</div>
          <h3 class="feature-title">Clean Design</h3>
          <p class="feature-description">Modern, minimal SVG output that looks great anywhere</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🎨</div>
          <h3 class="feature-title">Label Colors</h3>
          <p class="feature-description">Uses your actual GitHub label colors automatically</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🔄</div>
          <h3 class="feature-title">Real-time Updates</h3>
          <p class="feature-description">Roadmap updates automatically when issues change</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🔓</div>
          <h3 class="feature-title">No Auth Required</h3>
          <p class="feature-description">Works with public repositories out of the box</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3 class="feature-title">Fast & Serverless</h3>
          <p class="feature-description">Powered by Vercel's edge network for instant loading</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🎯</div>
          <h3 class="feature-title">Clickable Cards</h3>
          <p class="feature-description">Interactive viewer with direct links to GitHub issues</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="footer">
    <div class="container">
      <p>Built with ❤️ by <a href="https://github.com/rocketstack-matt" target="_blank">Matthew Bain</a></p>
      <p style="margin-top: 12px;">
        <a href="https://github.com/rocketstack-matt/roadmapper" target="_blank">GitHub</a> ·
        <a href="https://github.com/rocketstack-matt/roadmapper/issues" target="_blank">Issues</a> ·
        <a href="https://github.com/rocketstack-matt/roadmapper" target="_blank">Documentation</a>
      </p>
    </div>
  </footer>

  <script>
    // Theme toggle
    function toggleTheme() {
      const html = document.documentElement;
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);

      updateThemeButton(newTheme);
    }

    function updateThemeButton(theme) {
      const icon = document.getElementById('theme-icon');
      const text = document.getElementById('theme-text');

      if (theme === 'dark') {
        icon.textContent = '☀️';
        text.textContent = 'Light Mode';
      } else {
        icon.textContent = '🌙';
        text.textContent = 'Dark Mode';
      }
    }

    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);
  </script>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
};
