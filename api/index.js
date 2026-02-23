const { withMiddleware } = require('../lib/middleware');

const handler = async (req, res) => {
  // Detect environment: use localhost for local development, production URL otherwise
  const host = req.headers.host || 'roadmapper.rocketstack.co';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  const gaId = process.env.GA_MEASUREMENT_ID;
  const gaSnippet = gaId ? `
  <script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');</script>` : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">${gaSnippet}
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
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .logo {
      height: 35px;
      width: auto;
    }

    .logo-text {
      font-size: 24px;
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
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 14px;
      line-height: 1.8;
      color: var(--text-primary);
      margin: 24px 0;
    }

    .code-block code {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    /* URL Format Box */
    .url-format-box {
      background: linear-gradient(135deg, rgba(30, 136, 229, 0.05) 0%, rgba(38, 166, 154, 0.05) 100%);
      border: 2px solid var(--accent-blue);
      border-radius: 12px;
      padding: 32px;
      margin: 32px 0;
      text-align: center;
    }

    .url-format-title {
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 12px;
    }

    .url-format-description {
      color: var(--text-secondary);
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 24px;
      max-width: 700px;
      margin-left: auto;
      margin-right: auto;
    }

    .url-format-code {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 20px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 16px;
      margin: 24px 0;
      overflow-x: auto;
    }

    .url-format-code code {
      color: var(--text-primary);
    }

    .url-param {
      color: var(--accent-blue);
      font-weight: 600;
    }

    .url-param-optional {
      color: var(--accent-teal);
      font-weight: 600;
    }

    .url-params {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin: 24px 0;
      text-align: left;
    }

    .url-param-item {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
    }

    .url-param-item strong {
      display: block;
      color: var(--accent-blue);
      font-size: 15px;
      margin-bottom: 6px;
      font-family: 'Monaco', 'Menlo', monospace;
    }

    .url-param-item span {
      color: var(--text-secondary);
      font-size: 14px;
      line-height: 1.5;
    }

    .url-example {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      font-size: 14px;
      margin-top: 16px;
      text-align: left;
    }

    .url-example strong {
      color: var(--text-primary);
      margin-right: 8px;
    }

    .url-example code {
      color: var(--accent-green);
      font-family: 'Monaco', 'Menlo', monospace;
    }

    /* Embed Tabs */
    .embed-tabs {
      display: flex;
      gap: 12px;
      margin: 32px 0 24px 0;
      justify-content: center;
      flex-wrap: wrap;
    }

    .embed-tab {
      background: var(--bg-primary);
      border: 2px solid var(--border-color);
      color: var(--text-primary);
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 15px;
      font-weight: 600;
      transition: all 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    }

    .embed-tab:hover {
      border-color: var(--accent-blue);
      transform: translateY(-2px);
    }

    .embed-tab.active {
      background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-teal) 100%);
      border-color: var(--accent-blue);
      color: white;
    }

    .embed-content {
      margin-top: 24px;
    }

    .embed-option {
      display: none;
    }

    .embed-option.active {
      display: block;
    }

    .embed-description {
      color: var(--text-secondary);
      margin-bottom: 16px;
      line-height: 1.6;
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

    /* GitHub-style labels */
    .gh-label {
      display: inline-block;
      padding: 2px 8px;
      font-size: 12px;
      font-weight: 600;
      line-height: 18px;
      border-radius: 12px;
      white-space: nowrap;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    }

    .gh-label-now {
      background: #2da44e;
      color: white;
    }

    .gh-label-next {
      background: #fb8500;
      color: white;
    }

    .gh-label-later {
      background: #8b949e;
      color: white;
    }

    /* Step Sections */
    .step-section {
      display: flex;
      gap: 20px;
      margin-top: 48px;
    }

    .step-section:first-child {
      margin-top: 32px;
    }

    .step-number {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      min-width: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-teal) 100%);
      color: white;
      font-weight: 700;
      font-size: 16px;
      flex-shrink: 0;
    }

    .step-body {
      flex: 1;
      min-width: 0;
    }

    .step-title {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 6px;
      line-height: 36px;
    }

    .step-description {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.5;
      margin-bottom: 16px;
    }

    .step-description code {
      background: var(--bg-secondary);
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 13px;
    }

    @media (max-width: 600px) {
      .step-section {
        gap: 14px;
      }
    }

    /* Register Form */
    .register-card {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 32px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }

    @media (max-width: 600px) {
      .form-row {
        grid-template-columns: 1fr;
      }
    }

    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }

    .form-group input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      background: var(--bg-secondary);
      color: var(--text-primary);
      transition: border-color 0.2s;
    }

    .form-group input:focus {
      outline: none;
      border-color: var(--accent-blue);
    }

    .register-btn {
      background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-teal) 100%);
      color: white;
      border: none;
      padding: 12px 32px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .register-btn:hover {
      opacity: 0.9;
    }

    .register-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .result-success {
      margin-top: 24px;
      padding: 20px;
      background: #d4edda;
      border: 1px solid #c3e6cb;
      border-radius: 8px;
      color: #155724;
    }

    [data-theme="dark"] .result-success {
      background: #1a3a1a;
      border-color: #2d5a2d;
      color: #a3d9a5;
    }

    .result-success h3 {
      margin-bottom: 12px;
    }

    .key-display {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(0, 0, 0, 0.1);
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 16px;
      word-break: break-all;
    }

    [data-theme="dark"] .key-display {
      background: rgba(255, 255, 255, 0.1);
    }

    .key-display code {
      flex: 1;
      font-size: 14px;
      font-family: 'Monaco', 'Menlo', monospace;
    }

    .copy-key-btn {
      background: #155724;
      color: white;
      border: none;
      padding: 6px 14px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      white-space: nowrap;
    }

    [data-theme="dark"] .copy-key-btn {
      background: #2d5a2d;
    }

    .key-instructions {
      font-size: 14px;
      line-height: 1.6;
    }

    .key-instructions code {
      background: rgba(0, 0, 0, 0.1);
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 13px;
    }

    [data-theme="dark"] .key-instructions code {
      background: rgba(255, 255, 255, 0.1);
    }

    .key-step {
      margin-top: 8px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 6px;
      overflow-x: auto;
    }

    [data-theme="dark"] .key-step {
      background: rgba(255, 255, 255, 0.1);
    }

    .key-step code {
      background: none;
      padding: 0;
      font-size: 12px;
      white-space: pre;
    }

    .result-error {
      margin-top: 24px;
      padding: 16px 20px;
      background: #f8d7da;
      border: 1px solid #f5c6cb;
      border-radius: 8px;
      color: #721c24;
    }

    [data-theme="dark"] .result-error {
      background: #3a1a1a;
      border-color: #5a2d2d;
      color: #d9a3a3;
    }

    .result-confirmed {
      margin-top: 24px;
      padding: 20px;
      background: #d4edda;
      border: 1px solid #c3e6cb;
      border-radius: 8px;
      color: #155724;
      text-align: center;
    }

    [data-theme="dark"] .result-confirmed {
      background: #1a3a1a;
      border-color: #2d5a2d;
      color: #a3d9a5;
    }

    .result-confirmed .confirm-icon {
      font-size: 36px;
      margin-bottom: 8px;
    }

    .result-confirmed h3 {
      margin: 0 0 8px 0;
    }

    .result-confirmed p {
      margin: 0;
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

    .avatar {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      vertical-align: middle;
      margin-right: 6px;
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

      .logo {
        height: 30px;
      }

      .logo-text {
        font-size: 20px;
      }
    }
  </style>
  <script>
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  </script>
  <script defer src="/_vercel/insights/script.js"></script>
</head>
<body>
  <!-- Header -->
  <header class="header">
    <div class="container">
      <div class="header-content">
        <div class="logo-container">
          <img src="/logo.svg" alt="Roadmapper" class="logo">
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
          <p class="step-description">Add <span class="gh-label gh-label-now">Roadmap: Now</span>, <span class="gh-label gh-label-next">Roadmap: Next</span>, or <span class="gh-label gh-label-later">Roadmap: Later</span> labels to your GitHub issues</p>
        </div>
        <div class="step">
          <div class="step-number">2</div>
          <h3 class="step-title">Generate Your Roadmap</h3>
          <p class="step-description">Use our simple URL format with your repository details</p>
        </div>
        <div class="step">
          <div class="step-number">3</div>
          <h3 class="step-title">Share Anywhere</h3>
          <p class="step-description">Embed in your README, docs, or website - it refreshes automatically every hour</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Example -->
  <section class="section" style="background: var(--bg-secondary);">
    <div class="container">
      <h2 class="section-title">Live Example</h2>
      <p class="section-description">Click on any card to view the issue on GitHub</p>
      <div class="example-container">
        <iframe id="roadmap-iframe" src="${baseUrl}/embed/rocketstack-matt/roadmapper/ffffff/24292f" width="100%" height="520" frameborder="0" style="border: none; border-radius: 8px; transition: height 0.3s ease;"></iframe>
      </div>
    </div>
  </section>

  <!-- Get Started -->
  <section class="section" id="get-started">
    <div class="container">
      <h2 class="section-title">Get Started</h2>
      <p class="section-description">Register and confirm your email, then we'll show you how to add your key and embed your roadmap</p>

      <!-- Step 1: Register -->
      <div class="step-section">
        <span class="step-number">1</span>
        <div class="step-body">
          <h3 class="step-title">Register your repository</h3>
          <p class="step-description">Enter your GitHub repo details to get an API key. This key identifies your repository and enables roadmap generation.</p>

          <div class="register-card">
            <form id="register-form" onsubmit="handleRegister(event)">
              <div class="form-row">
                <div class="form-group">
                  <label for="reg-owner">GitHub Owner</label>
                  <input type="text" id="reg-owner" placeholder="e.g. finos" required>
                </div>
                <div class="form-group">
                  <label for="reg-repo">Repository</label>
                  <input type="text" id="reg-repo" placeholder="e.g. architecture-as-code" required>
                </div>
                <div class="form-group">
                  <label for="reg-email">Email</label>
                  <input type="email" id="reg-email" placeholder="you@example.com" required>
                </div>
              </div>
              <button type="submit" class="register-btn" id="register-btn">Register</button>
            </form>

            <div id="register-result" style="display: none;">
              <div id="register-success" style="display: none;">
                <div class="result-success">
                  <h3>Your API Key</h3>
                  <div class="key-display">
                    <code id="api-key-value"></code>
                    <button onclick="copyKey()" class="copy-key-btn">Copy</button>
                  </div>
                  <div class="key-instructions">
                    <p><strong>Save this key now</strong> — it will not be shown again.</p>
                    <p>Next, follow Step 2 below to add this key to your repository.</p>
                  </div>
                </div>
              </div>
              <div id="register-error" style="display: none;">
                <div class="result-error">
                  <p id="register-error-msg"></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="steps-2-3" style="display: none;">
      <!-- Step 2: Add key to repo -->
      <div class="step-section">
        <span class="step-number">2</span>
        <div class="step-body">
          <h3 class="step-title">Add the key to your repository</h3>
          <p class="step-description">Create a <code>.roadmapper</code> file in the root of your repo containing your API key. This proves you own the repository and authorizes Roadmapper to generate roadmaps for it. The key is checked once and then cached — Roadmapper only re-verifies it every 24 hours.</p>

          <div class="register-card">
            <div class="key-step" style="display: flex; align-items: center; gap: 12px;">
              <code id="step2-command" style="flex: 1;">echo "rm_your_key_here" > .roadmapper && git add .roadmapper && git commit -m "Add Roadmapper key" && git push</code>
              <button onclick="copyStep2Command()" class="copy-key-btn" id="step2-copy-btn">Copy</button>
            </div>
            <p style="margin-top: 12px; font-size: 13px; color: var(--text-secondary);">The <code>.roadmapper</code> file should contain only the API key — nothing else. It's safe to commit to public repos since the key is only used to identify your repository with Roadmapper.</p>
          </div>
        </div>
      </div>

      <!-- Step 3: Embed -->
      <div class="step-section">
        <span class="step-number">3</span>
        <div class="step-body">
          <h3 class="step-title">Embed your roadmap</h3>
          <p class="step-description">Your roadmap URL follows this format — just swap in your details:</p>

          <div class="url-format-box">
            <div class="url-format-code">
              <code>https://roadmapper.rocketstack.co/<span class="url-param">{owner}</span>/<span class="url-param">{repo}</span>/<span class="url-param">{bgColor}</span>/<span class="url-param">{textColor}</span></code>
            </div>

            <div class="url-params">
              <div class="url-param-item">
                <strong>owner</strong>
                <span>Your GitHub username or organization</span>
              </div>
              <div class="url-param-item">
                <strong>repo</strong>
                <span>Your repository name</span>
              </div>
              <div class="url-param-item">
                <strong>bgColor</strong>
                <span>Background color as hex (without #)</span>
              </div>
              <div class="url-param-item">
                <strong>textColor</strong>
                <span>Text color as hex (without #)</span>
              </div>
            </div>

            <div class="url-example">
              <strong>Example:</strong> <code>https://roadmapper.rocketstack.co/rocketstack-matt/roadmapper/ffffff/24292f</code>
              <p style="margin-top: 8px; color: var(--text-secondary); font-size: 14px;">White background (ffffff) with dark text (24292f)</p>
            </div>
          </div>

          <h4 style="margin-top: 32px; margin-bottom: 16px; font-size: 18px; color: var(--text-primary);">Choose your embedding method</h4>

          <div class="embed-tabs">
            <button class="embed-tab active" onclick="showEmbedOption('github')">GitHub README</button>
            <button class="embed-tab" onclick="showEmbedOption('iframe')">Website (iframe)</button>
            <button class="embed-tab" onclick="showEmbedOption('html')">HTML Image Map</button>
          </div>

          <div class="embed-content">
            <div id="embed-github" class="embed-option active">
              <p class="embed-description">For GitHub READMEs - Link to the viewer page for clickable cards (GitHub strips interactive elements from embedded images):</p>
              <div class="code-block" style="display: flex; align-items: flex-start; gap: 12px;">
                <code id="embed-github-code" style="flex: 1;">[![Roadmap](https://roadmapper.rocketstack.co/your-username/your-repo/ffffff/24292f)](https://roadmapper.rocketstack.co/view/your-username/your-repo/ffffff/24292f)

> Click the roadmap to view the interactive version with clickable cards.</code>
                <button onclick="copyEmbedCode('github')" class="copy-key-btn" id="copy-embed-github">Copy</button>
              </div>
            </div>

            <div id="embed-iframe" class="embed-option">
              <p class="embed-description">For websites and documentation - Embed directly with clickable cards using an iframe:</p>
              <div class="code-block" style="display: flex; align-items: flex-start; gap: 12px;">
                <code id="embed-iframe-code" style="flex: 1;">&lt;iframe src="https://roadmapper.rocketstack.co/embed/your-username/your-repo/ffffff/24292f"
        width="100%" height="520" frameborder="0"&gt;&lt;/iframe&gt;</code>
                <button onclick="copyEmbedCode('iframe')" class="copy-key-btn" id="copy-embed-iframe">Copy</button>
              </div>
            </div>

            <div id="embed-html" class="embed-option">
              <p class="embed-description">For advanced embedding - Use HTML image maps for direct embedding with clickable regions:</p>
              <div class="code-block" style="display: flex; align-items: flex-start; gap: 12px;">
                <code id="embed-html-code" style="flex: 1;">&lt;!-- Visit the link below to generate the HTML code --&gt;
https://roadmapper.rocketstack.co/html/your-username/your-repo/ffffff/24292f</code>
                <button onclick="copyEmbedCode('html')" class="copy-key-btn" id="copy-embed-html">Copy</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
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
          <h3 class="feature-title">Auto Updates</h3>
          <p class="feature-description">Your roadmap refreshes every 60 minutes — just update your GitHub issue labels and the changes appear automatically</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">🔑</div>
          <h3 class="feature-title">Per-Repo Keys</h3>
          <p class="feature-description">Simple registration proves ownership via a file in your repo</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3 class="feature-title">Fast & Cached</h3>
          <p class="feature-description">Responses cached at the edge for instant loading</p>
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
      <p>Built with ❤️ by <a href="https://github.com/rocketstack-matt" target="_blank"><img src="/rocketstack-matt.png" alt="rocketstack-matt" class="avatar">@rocketstack-matt</a></p>
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
      updateRoadmapTheme(newTheme);
    }

    function updateRoadmapTheme(theme) {
      const iframe = document.getElementById('roadmap-iframe');
      if (!iframe) return;
      const colors = theme === 'dark'
        ? { bg: '0d1117', text: 'e6edf3' }
        : { bg: 'ffffff', text: '24292f' };
      iframe.src = iframe.src.replace(
        /\\/[0-9a-fA-F]{3,6}\\/[0-9a-fA-F]{3,6}(\\/?)(\\?.*)?$/,
        '/' + colors.bg + '/' + colors.text + '$1$2'
      );
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
    updateRoadmapTheme(savedTheme);

    // Auto-resize roadmap iframe to match SVG content height
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'roadmap-resize' && e.data.height > 0) {
        var iframe = document.getElementById('roadmap-iframe');
        if (iframe) {
          iframe.style.height = e.data.height + 'px';
        }
      }
    });

    // Handle confirmation query params on page load
    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function onPageLoad() {
      var params = new URLSearchParams(window.location.search);

      if (params.get('confirmed') === 'true') {
        var owner = params.get('owner') || '';
        var repo = params.get('repo') || '';
        var key = params.get('key') || '';

        // Replace the registration form with a success banner
        var registerCard = document.querySelector('.register-card');
        registerCard.innerHTML =
          '<div class="result-confirmed">' +
            '<div class="confirm-icon">&#10003;</div>' +
            '<h3>Email Confirmed!</h3>' +
            '<p>Your API key for <strong>' + escapeHtml(owner) + '/' + escapeHtml(repo) + '</strong> is now active.</p>' +
          '</div>';

        // Update Step 2 command with the actual key
        if (key) {
          document.getElementById('step2-command').textContent =
            'echo "' + key + '" > .roadmapper && git add .roadmapper && git commit -m "Add Roadmapper key" && git push';
        }

        // Update Step 3 embed codes with repo details
        if (owner && repo) {
          var repoPath = owner + '/' + repo;
          document.getElementById('embed-github-code').textContent =
            '[![Roadmap](https://roadmapper.rocketstack.co/' + repoPath + '/ffffff/24292f)](https://roadmapper.rocketstack.co/view/' + repoPath + '/ffffff/24292f)\\n\\n> Click the roadmap to view the interactive version with clickable cards.';
          document.getElementById('embed-iframe-code').textContent =
            '<iframe src="https://roadmapper.rocketstack.co/embed/' + repoPath + '/ffffff/24292f"\\n        width="100%" height="520" frameborder="0"></iframe>';
          document.getElementById('embed-html-code').textContent =
            '<!-- Visit the link below to generate the HTML code -->\\nhttps://roadmapper.rocketstack.co/html/' + repoPath + '/ffffff/24292f';
        }

        // Show Steps 2 and 3
        document.getElementById('steps-2-3').style.display = '';

        // Scroll to the Get Started section
        document.getElementById('get-started').scrollIntoView({ behavior: 'smooth' });

        // Clean URL
        history.replaceState(null, '', '/');

      } else if (params.get('confirm_error')) {
        var errorMsg = params.get('confirm_error');

        // Show error in the register-result area
        var resultDiv = document.getElementById('register-result');
        var errorDiv = document.getElementById('register-error');
        document.getElementById('register-error-msg').textContent = errorMsg;
        resultDiv.style.display = 'block';
        errorDiv.style.display = 'block';

        // Scroll to the Get Started section
        document.getElementById('get-started').scrollIntoView({ behavior: 'smooth' });

        // Clean URL
        history.replaceState(null, '', '/');
      }
    }

    onPageLoad();

    // Embed option toggle
    function showEmbedOption(option) {
      // Hide all options
      document.querySelectorAll('.embed-option').forEach(el => {
        el.classList.remove('active');
      });

      // Remove active state from all tabs
      document.querySelectorAll('.embed-tab').forEach(el => {
        el.classList.remove('active');
      });

      // Show selected option
      document.getElementById('embed-' + option).classList.add('active');

      // Add active state to clicked tab
      event.target.classList.add('active');
    }

    // Registration form handler
    async function handleRegister(e) {
      e.preventDefault();

      const btn = document.getElementById('register-btn');
      const resultDiv = document.getElementById('register-result');
      const successDiv = document.getElementById('register-success');
      const errorDiv = document.getElementById('register-error');

      btn.disabled = true;
      btn.textContent = 'Registering...';
      resultDiv.style.display = 'none';
      successDiv.style.display = 'none';
      errorDiv.style.display = 'none';

      const owner = document.getElementById('reg-owner').value.trim();
      const repo = document.getElementById('reg-repo').value.trim();
      const email = document.getElementById('reg-email').value.trim();

      try {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner, repo, email }),
        });

        const data = await response.json();
        resultDiv.style.display = 'block';

        if (response.ok) {
          document.getElementById('api-key-value').textContent = data.key;
          successDiv.style.display = 'block';

          if (data.pendingConfirmation) {
            btn.textContent = 'Check your email!';
            document.querySelector('.key-instructions').innerHTML =
              '<p><strong>Check your email!</strong> A confirmation link has been sent to your email address.</p>' +
              '<p>Your key will activate after you click the confirmation link (expires in 24 hours).</p>' +
              '<p style="margin-top: 12px;">Once confirmed, you will be redirected here with the next steps ready to go.</p>';
          } else {
            btn.textContent = 'Registered!';
            document.querySelector('.key-instructions').innerHTML =
              '<p><strong>Save this key now</strong> — it will not be shown again.</p>' +
              '<p>Next, follow Step 2 below to add this key to your repository.</p>';
            document.getElementById('steps-2-3').style.display = '';
          }

          // Update Step 2 command with the actual key
          const step2 = document.getElementById('step2-command');
          step2.textContent = 'echo "' + data.key + '" > .roadmapper && git add .roadmapper && git commit -m "Add Roadmapper key" && git push';

          // Update Step 3 embed codes with repo details
          const repoPath = owner + '/' + repo;
          document.getElementById('embed-github-code').textContent =
            '[![Roadmap](https://roadmapper.rocketstack.co/' + repoPath + '/ffffff/24292f)](https://roadmapper.rocketstack.co/view/' + repoPath + '/ffffff/24292f)\\n\\n> Click the roadmap to view the interactive version with clickable cards.';
          document.getElementById('embed-iframe-code').textContent =
            '<iframe src="https://roadmapper.rocketstack.co/embed/' + repoPath + '/ffffff/24292f"\\n        width="100%" height="520" frameborder="0"></iframe>';
          document.getElementById('embed-html-code').textContent =
            '<!-- Visit the link below to generate the HTML code -->\\nhttps://roadmapper.rocketstack.co/html/' + repoPath + '/ffffff/24292f';
        } else {
          document.getElementById('register-error-msg').textContent = data.error || 'Registration failed';
          errorDiv.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Register';
        }
      } catch (err) {
        resultDiv.style.display = 'block';
        document.getElementById('register-error-msg').textContent = 'Network error. Please try again.';
        errorDiv.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Register';
      }
    }

    function copyKey() {
      const key = document.getElementById('api-key-value').textContent;
      navigator.clipboard.writeText(key).then(() => {
        const btn = document.querySelector('.copy-key-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    }

    function copyStep2Command() {
      const command = document.getElementById('step2-command').textContent;
      navigator.clipboard.writeText(command).then(() => {
        const btn = document.getElementById('step2-copy-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    }

    function copyEmbedCode(type) {
      const code = document.getElementById('embed-' + type + '-code').textContent;
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('copy-embed-' + type);
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    }
  </script>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
};

module.exports = withMiddleware(handler, { skipAll: true });
