const { withMiddleware } = require('../lib/middleware');
const { gaSnippet } = require('../lib/analytics');
const { escapeXml } = require('../roadmap');
const { TIERS } = require('../lib/tiers');
const { getMarketplaceUrl } = require('../lib/marketplace');
const {
  isAppConfigured,
  isWebhookConfigured,
  getInstallationRepos,
  getInstallationTier,
} = require('../lib/github-app');

const DEFAULT_COLORS = 'ffffff/24292f';

// The column labels a repo needs, with the colours the README suggests.
// Names must match exactly: the renderer compares them case-sensitively.
const LABEL_GUIDE = [
  { name: 'Roadmap: Now', color: '2da44e', meaning: 'being worked on now' },
  { name: 'Roadmap: Next', color: 'fb8500', meaning: 'planned next' },
  { name: 'Roadmap: Later', color: '8b949e', meaning: 'longer term' },
];

const page = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">${gaSnippet()}
  <title>${title} - Roadmapper</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg-primary: #ffffff;
      --bg-secondary: #f6f8fa;
      --text-primary: #1a1a1a;
      --text-secondary: #57606a;
      --border-color: #e0e0e0;
      --accent-blue: #1E88E5;
      --accent-teal: #26A69A;
      --accent-green: #66BB6A;
    }
    [data-theme="dark"] {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --text-primary: #e6edf3;
      --text-secondary: #8b949e;
      --border-color: #30363d;
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: var(--text-primary); background: var(--bg-secondary); }
    .container { max-width: 860px; margin: 0 auto; padding: 32px 20px 64px; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
    .logo { display: flex; flex-direction: column; align-items: center; gap: 8px; text-decoration: none; }
    .logo img { height: 35px; width: auto; }
    .logo span { font-size: 20px; font-weight: 600; background: linear-gradient(135deg, var(--accent-blue), var(--accent-teal), var(--accent-green)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .theme-toggle { background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 14px; }
    h1 { font-size: 28px; margin-bottom: 8px; }
    .lead { color: var(--text-secondary); margin-bottom: 24px; }
    .notice { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; color: var(--text-secondary); font-size: 14px; }
    .notice strong { color: var(--text-primary); }
    .repo { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .repo h2 { font-size: 18px; margin-bottom: 12px; word-break: break-all; }
    .label { font-size: 13px; font-weight: 600; color: var(--text-secondary); margin: 12px 0 6px; }
    .code-row { display: flex; gap: 12px; align-items: flex-start; }
    code { flex: 1; display: block; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px 12px; font-size: 13px; white-space: pre-wrap; word-break: break-all; }
    .copy-btn { background: linear-gradient(135deg, var(--accent-blue), var(--accent-teal)); color: white; border: none; border-radius: 6px; padding: 8px 14px; cursor: pointer; font-size: 13px; font-weight: 600; }
    .links { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px; font-size: 14px; }
    .steps { list-style: none; counter-reset: step; }
    .steps > li { counter-increment: step; position: relative; padding-left: 36px; margin-top: 20px; }
    .steps > li::before { content: counter(step); position: absolute; left: 0; top: 0; width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-blue), var(--accent-teal)); color: white; font-size: 13px; font-weight: 700; text-align: center; line-height: 24px; }
    .steps h3 { font-size: 15px; margin-bottom: 4px; }
    .hint { color: var(--text-secondary); font-size: 14px; }
    .label-row { display: flex; gap: 12px; align-items: center; margin-top: 8px; font-size: 14px; }
    .chip { display: inline-block; padding: 2px 10px; border-radius: 12px; color: white; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .label-row .copy-btn { padding: 4px 10px; font-size: 12px; }
    a { color: var(--accent-blue); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <a class="logo" href="/"><img src="/logo.svg" alt=""><span>Roadmapper</span></a>
      <button class="theme-toggle" onclick="toggleTheme()"><span id="theme-icon">🌙</span></button>
    </header>
    ${body}
  </div>
  <script>
    function updateThemeIcon(theme) {
      document.getElementById('theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    function toggleTheme() {
      var theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      updateThemeIcon(theme);
    }
    var savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    function copyCode(id, btn) {
      navigator.clipboard.writeText(document.getElementById(id).textContent).then(function () {
        btn.textContent = 'Copied!';
        setTimeout(function () { btn.textContent = 'Copy'; }, 2000);
      });
    }
  </script>
</body>
</html>`;

const send = (res, status, title, body) => {
  res.status(status);
  res.setHeader('Content-Type', 'text/html');
  res.send(page(escapeXml(title), body));
};

const message = (res, status, title, text) => send(res, status, title,
  `<h1>${escapeXml(title)}</h1><p class="lead">${text}</p><p><a href="/">Back to Roadmapper</a></p>`);

const setupGuide = (freshness) => {
  const labels = LABEL_GUIDE.map((label, i) => `
          <div class="label-row"><span class="chip" style="background: #${label.color}" id="label-${i}">${escapeXml(label.name)}</span><button class="copy-btn" onclick="copyCode('label-${i}', this)">Copy</button><span class="hint">#${label.color} · ${label.meaning}</span></div>`).join('');
  return `<section class="repo">
    <h2>Set up your roadmap</h2>
    <p class="hint">For each repository below, create these labels using the exact names; each label’s colour becomes the accent on its cards. Skip any the repo already has.</p>
    ${labels}
    <p class="hint">Add one of the labels to each issue you want on the roadmap. Only open issues appear; pull requests are ignored. Then preview your roadmap and copy an embed snippet below.</p>
    <p class="hint">${freshness}</p>
  </section>`;
};

const repoCard = (baseUrl, { owner, repo }, index) => {
  const path = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const github = `https://github.com/${path}`;
  const image = `${baseUrl}/${path}/${DEFAULT_COLORS}`;
  const view = `${baseUrl}/view/${path}/${DEFAULT_COLORS}`;
  const embed = `${baseUrl}/embed/${path}/${DEFAULT_COLORS}`;
  const markdown = `[![Roadmap](${image})](${view})`;
  const iframe = `<iframe src="${embed}" width="100%" height="520" frameborder="0"></iframe>`;
  const newIssue = `${github}/issues/new?labels=${encodeURIComponent(LABEL_GUIDE[0].name)}`;
  return `
    <div class="repo">
      <h2>${escapeXml(`${owner}/${repo}`)}</h2>
      <ol class="steps">
        <li>
          <h3>Create the roadmap labels</h3>
          <div class="links"><a href="${escapeXml(`${github}/labels`)}" target="_blank">Open labels on GitHub</a></div>
        </li>
        <li>
          <h3>Label an open issue</h3>
          <div class="links">
            <a href="${escapeXml(newIssue)}" target="_blank">New issue labelled Roadmap: Now</a>
            <a href="${escapeXml(`${github}/issues`)}" target="_blank">Label an existing issue</a>
          </div>
        </li>
        <li>
          <h3>Preview your roadmap</h3>
          <div class="links"><a href="${escapeXml(view)}" target="_blank">Open the preview</a></div>
        </li>
        <li>
          <h3>Embed it</h3>
          <div class="label">GitHub README (Markdown)</div>
          <div class="code-row"><code id="md-${index}">${escapeXml(markdown)}</code><button class="copy-btn" onclick="copyCode('md-${index}', this)">Copy</button></div>
          <div class="label">Website (iframe)</div>
          <div class="code-row"><code id="iframe-${index}">${escapeXml(iframe)}</code><button class="copy-btn" onclick="copyCode('iframe-${index}', this)">Copy</button></div>
          <div class="links">
            <a href="${escapeXml(image)}" target="_blank">SVG image</a>
            <a href="${escapeXml(view)}" target="_blank">Interactive viewer</a>
            <a href="${escapeXml(embed)}" target="_blank">Embed page</a>
            <a href="${escapeXml(`${baseUrl}/html/${path}/${DEFAULT_COLORS}`)}" target="_blank">HTML image map</a>
          </div>
        </li>
      </ol>
    </div>`;
};

/**
 * The GitHub App's setup URL: GitHub sends the user here after they install
 * the App (or change its repos) with ?installation_id=…&setup_action=….
 * Lists the installation's public repos and their embed URLs. Private repos
 * are only counted, never named: this page needs no sign-in.
 */
const handler = async (req, res) => {
  const host = req.headers.host || 'roadmapper.rocketstack.co';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  if (!isAppConfigured()) {
    return message(res, 404, 'GitHub App not available', 'The Roadmapper GitHub App isn\'t set up on this server.');
  }

  const params = new URL(req.url, baseUrl).searchParams;
  if (params.get('setup_action') === 'request') {
    return message(res, 200, 'Installation requested',
      'An owner of the organization needs to approve the Roadmapper GitHub App. Once they have, your roadmaps work straight away.');
  }

  const installationId = params.get('installation_id') || '';
  if (!/^\d+$/.test(installationId)) {
    return message(res, 400, 'No installation given', 'Install the Roadmapper GitHub App from the <a href="/#get-started">Get Started</a> section and GitHub will bring you back here.');
  }

  let installation;
  let tier;
  try {
    installation = await getInstallationRepos(installationId);
    tier = installation && await getInstallationTier(installationId);
  } catch (error) {
    console.error(`Setup page lookup failed for installation ${installationId}: ${error.message}`);
    return message(res, 502, 'Couldn\'t reach GitHub', 'We couldn\'t read this installation from GitHub. Please refresh the page in a moment.');
  }
  if (!installation) {
    return message(res, 404, 'Installation not found', 'This GitHub App installation doesn\'t exist, or the App has been uninstalled.');
  }

  const publicRepos = installation.repositories.filter(r => !r.private);
  const privateCount = installation.repositories.length - publicRepos.length;
  const account = installation.account ? ` for <strong>${escapeXml(installation.account)}</strong>` : '';

  const paidNotice = isWebhookConfigured()
    ? '<strong>Paid plan:</strong> roadmaps update within seconds of an issue changing.'
    : `<strong>Paid plan:</strong> roadmaps refresh every ${TIERS.paid.cacheTtl} seconds.`;
  const marketplaceUrl = getMarketplaceUrl();
  const upgrade = marketplaceUrl
    ? `<a href="${escapeXml(marketplaceUrl)}" target="_blank">upgrade on GitHub Marketplace</a>`
    : '<a href="https://github.com/rocketstack-matt/roadmapper/issues" target="_blank">get in touch</a> to upgrade';
  const tierNotice = tier === 'paid'
    ? paidNotice
    : `<strong>Free plan:</strong> roadmaps refresh hourly. The paid plan updates them within seconds of an issue changing — ${upgrade}.`;
  const privateNotice = privateCount
    ? `<div class="notice">${privateCount} private ${privateCount === 1 ? 'repository is' : 'repositories are'} not shown: Roadmapper only serves public repositories for now.</div>`
    : '';
  // A free repo's empty roadmap stays cached for its hourly soft TTL, so say
  // so rather than let a preview opened before labelling look broken.
  const emptyHint = 'If the roadmap is empty, check that the label names match exactly.';
  const freshness = tier !== 'paid'
    ? `${emptyHint} Free roadmaps refresh hourly, so if you opened the preview before labelling an issue it can take up to an hour to appear.`
    : isWebhookConfigured()
      ? `${emptyHint} Label changes show within seconds; reload the preview.`
      : `${emptyHint} Roadmaps refresh every ${TIERS.paid.cacheTtl} seconds; reload the preview.`;
  const repos = publicRepos.length
    ? publicRepos.map((r, i) => repoCard(baseUrl, r, i)).join('')
    : '<div class="notice">No public repositories are connected yet. <a href="https://github.com/settings/installations" target="_blank">Add one in the App\'s settings on GitHub</a> and refresh this page.</div>';

  send(res, 200, 'GitHub App installed', `
    <h1>Roadmapper is installed</h1>
    <p class="lead">The GitHub App is connected${account}. Follow the steps below to label your first issue, preview the roadmap and add it to your README.</p>
    <div class="notice">${tierNotice}</div>
    ${privateNotice}
    ${publicRepos.length ? setupGuide(freshness) : ''}
    ${repos}`);
};

module.exports = withMiddleware(handler, { ipRateLimitOnly: true });
