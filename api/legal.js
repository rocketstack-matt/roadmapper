const { withMiddleware } = require('../lib/middleware');
const { gaSnippet } = require('../lib/analytics');

// Who runs the service and how to reach them, used throughout both documents.
const OPERATOR = 'Westwood Hill (CP) Ltd, trading as Rocketstack';
const CONTACT_EMAIL = 'matt@rocketstack.co';
const GOVERNING_LAW = 'England and Wales';
const LAST_UPDATED = '1 November 2026';

const contact = `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`;

const PRIVACY = {
  title: 'Privacy Policy',
  body: `
    <p>Roadmapper (<a href="https://roadmapper.rocketstack.co">roadmapper.rocketstack.co</a>) turns GitHub issues into roadmap images. It is run by ${OPERATOR} ("we", "us"). This policy explains what we collect when you use the website, the API key registration or the Roadmapper GitHub App, and what we do with it. We are the controller of this data. If you have a question, email ${contact}.</p>

    <h2>What we collect</h2>
    <h3>When you register for an API key</h3>
    <ul>
      <li>The repository owner and name you enter, and your email address.</li>
      <li>A one-way hash of your API key and the date you registered. Until you confirm your email address, we also hold the key itself for up to 24 hours so we can show it to you after you confirm; it is deleted when you confirm or when the confirmation link expires.</li>
    </ul>
    <h3>When you install the GitHub App</h3>
    <ul>
      <li>The installation's ID and account name, the names of the repositories it covers and whether each is public or private, and the installation's plan.</li>
      <li>The webhook events GitHub sends us when installations, repositories, issues or labels change. We use them to keep roadmaps up to date and don't keep the event contents.</li>
    </ul>
    <h3>When a roadmap is shown</h3>
    <ul>
      <li>For the repository shown: the number, title, link and labels of open issues that carry a <code>Roadmap</code> label. We keep a copy so we don't fetch it from GitHub on every view. We don't read your code or any other issues; the only file we read is the <code>.roadmapper</code> file, if you use an API key.</li>
      <li>The IP address of the request, which we use to apply rate limits.</li>
      <li>Standard request logs (such as IP address, URL, time and browser user agent) kept by our hosting provider.</li>
    </ul>
    <h3>Analytics</h3>
    <ul>
      <li>Our web pages use Google Analytics, which sets cookies and collects information about your visit, such as pages viewed, your browser and approximate location.</li>
      <li>When a roadmap image is viewed, we send Google Analytics an event with the repository shown and the viewer's IP address, so we can count views.</li>
    </ul>
    <p>We don't ask for or collect any other personal data, and the GitHub App has read-only access: it never writes to your repositories.</p>

    <h3>Private repositories</h3>
    <p>Roadmapper doesn't show private repositories yet: support for them is coming on plans that include it. This section describes how we will handle their data once it's available. We will read the same issue data from them as from public ones, using the access you grant the GitHub App. We will treat it as confidential: we will use it only to show your roadmap and won't share it with anyone except the providers below. When the App's access to the repository ends, we stop showing and refreshing our copy, and we delete it when you ask (see "How long we keep it").</p>

    <h2>How we use it</h2>
    <ul>
      <li>To provide the service: verify that a repository is registered or installed, fetch and render its roadmap, and apply its plan.</li>
      <li>To send you the email confirming your registration. We don't send marketing email.</li>
      <li>To protect the service from abuse with rate limits.</li>
      <li>To understand how the service is used and improve it.</li>
    </ul>
    <p>Our legal bases are performance of our agreement with you (providing the service you signed up for) and our legitimate interests in running, securing and improving it.</p>

    <h2>Who we share it with</h2>
    <p>We don't sell your data. We share it only with the providers that run the service for us:</p>
    <ul>
      <li><strong>GitHub</strong>, where we read repositories and issues.</li>
      <li><strong>Vercel</strong>, which hosts the service.</li>
      <li><strong>Upstash</strong>, which stores registrations, installation records, cached roadmaps and rate limit counters.</li>
      <li><strong>Resend</strong>, which sends confirmation emails.</li>
      <li><strong>Google</strong>, for Google Analytics.</li>
    </ul>
    <p>These providers may process data outside your country, including in the United States. We may also disclose data where the law requires it.</p>

    <h2>How long we keep it</h2>
    <ul>
      <li><strong>Registrations</strong> are kept until you ask us to delete them. An unconfirmed registration expires after 24 hours.</li>
      <li><strong>Installation records</strong> are deleted when you uninstall the GitHub App.</li>
      <li><strong>Cached roadmap data</strong> is replaced as the repository's issues change. When the App's access to a repository ends, or its registration is removed, we stop showing and refreshing it. To have it deleted, email ${contact}.</li>
      <li><strong>Rate limit counters</strong> expire after about an hour.</li>
      <li><strong>Logs and analytics</strong> are kept for the periods set by Vercel and Google Analytics.</li>
    </ul>

    <h2>Your rights</h2>
    <p>Depending on where you live, you may have the right to access, correct or delete your personal data, to object to or restrict how we use it, and to receive a copy of it. Email ${contact} and we'll respond within a month. You can block analytics cookies in your browser settings. If you're unhappy with how we've handled your data, you can complain to your local data protection authority.</p>

    <h2>Children</h2>
    <p>Roadmapper isn't intended for children under 13, and we don't knowingly collect their data.</p>

    <h2>Changes</h2>
    <p>We'll post any changes to this policy on this page and update the date at the top.</p>`,
};

const TERMS = {
  title: 'Terms of Service',
  body: `
    <p>These terms govern your use of Roadmapper (<a href="https://roadmapper.rocketstack.co">roadmapper.rocketstack.co</a>), including the website, the API key registration and the Roadmapper GitHub App (the "service"). The service is run by ${OPERATOR} ("we", "us"). By using it, you agree to these terms. If you use it on behalf of an organisation, you agree to them for that organisation.</p>

    <h2>The service</h2>
    <p>Roadmapper reads the open issues of a GitHub repository that carry <code>Roadmap</code> labels and shows them as a roadmap you can embed. To use it, a repository must have the Roadmapper GitHub App installed or be registered with an API key. The service doesn't support private repositories yet; support is coming on plans that include it, and only through the GitHub App.</p>

    <h2>Your responsibilities</h2>
    <ul>
      <li>Only install the App on, or register, repositories you own or are authorised to manage.</li>
      <li>Give a valid email address when you register, and keep your API key safe. Anyone with the key can use it for its repository.</li>
      <li>Don't use the service to break the law or anyone else's rights, or to display content that does.</li>
      <li>Don't try to get around rate limits, overload or disrupt the service, or access data that isn't yours.</li>
      <li>Follow GitHub's terms when using the GitHub App.</li>
    </ul>

    <h2>Your content</h2>
    <p>You keep all rights to your repositories and issues. You give us permission to fetch, cache, render and display the issue data of the repositories you connect, for the purpose of providing the service. Anyone with a public repository's roadmap URL can view it.</p>
    <p>Once private repositories are supported, you will decide who sees a private repository's roadmap. It will show the titles, links and labels of the issues you label for it to whoever you give access, so only label issues whose details you're happy for them to see. We will keep that data confidential and use it only to provide the service.</p>

    <h2>The GitHub App</h2>
    <p>The App asks for read-only access to issues, contents and metadata, for public and private repositories alike. It never writes to your repositories, and reads only the issues and files described in our <a href="/privacy">Privacy Policy</a>. You can remove it at any time from your GitHub settings, which stops the service for those repositories.</p>

    <h2>Plans and fees</h2>
    <p>The free plan costs nothing. The paid plan is billed as agreed with you when you upgrade. We may change plans, features and limits, and we'll give paid customers reasonable notice of changes that affect what they pay for.</p>

    <h2>Availability</h2>
    <p>We aim to keep the service running, but we don't guarantee that it will always be available, error-free or up to date. We may change, suspend or discontinue it, or any part of it.</p>

    <h2>Suspension and termination</h2>
    <p>You can stop using the service at any time by uninstalling the App or removing your <code>.roadmapper</code> file; email ${contact} to have your registration deleted. We may suspend or end your access if you break these terms or your use puts the service or others at risk.</p>

    <h2>Disclaimer</h2>
    <p>The service is provided "as is" and "as available", without warranties of any kind, express or implied, including fitness for a particular purpose and non-infringement, to the extent the law allows.</p>

    <h2>Limitation of liability</h2>
    <p>To the extent the law allows, we aren't liable for any indirect, incidental, special or consequential loss, or for loss of profits, revenue or data, arising from your use of the service. Our total liability to you is limited to the amount you paid us for the service in the 12 months before the claim, or £100 if you're on the free plan. Nothing in these terms limits liability that can't be limited by law.</p>

    <h2>Open source</h2>
    <p>Roadmapper's source code is published under the <a href="https://github.com/rocketstack-matt/roadmapper/blob/main/LICENSE">Apache License 2.0</a>. That licence governs the code; these terms govern the hosted service.</p>

    <h2>Governing law</h2>
    <p>These terms are governed by the law of ${GOVERNING_LAW}, and its courts have exclusive jurisdiction over any dispute about them.</p>

    <h2>Changes</h2>
    <p>We may update these terms. We'll post the new version on this page and update the date at the top; continuing to use the service after that means you accept them.</p>

    <h2>Contact</h2>
    <p>Questions about these terms? Email ${contact}.</p>`,
};

const PAGES = { '/privacy': PRIVACY, '/terms': TERMS };

const page = ({ title, body }) => `<!DOCTYPE html>
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
    article { background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; padding: 32px; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    .updated { color: var(--text-secondary); font-size: 14px; margin-bottom: 24px; }
    h2 { font-size: 20px; margin: 28px 0 8px; }
    h3 { font-size: 16px; margin: 16px 0 4px; }
    p { margin-bottom: 12px; }
    ul { margin: 0 0 12px 24px; }
    li { margin-bottom: 4px; }
    code { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; padding: 1px 6px; font-size: 14px; }
    footer { margin-top: 24px; text-align: center; font-size: 14px; color: var(--text-secondary); }
    a { color: var(--accent-blue); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <a class="logo" href="/"><img src="/logo.svg" alt=""><span>Roadmapper</span></a>
      <button class="theme-toggle" onclick="toggleTheme()"><span id="theme-icon">🌙</span></button>
    </header>
    <article>
      <h1>${title}</h1>
      <p class="updated">Last updated ${LAST_UPDATED}</p>
      ${body}
    </article>
    <footer><a href="/">Home</a> · <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a></footer>
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
  </script>
</body>
</html>`;

/**
 * The privacy policy (/privacy) and terms of service (/terms): static pages,
 * linked from the site footers and the GitHub App's Marketplace listing.
 */
const handler = async (req, res) => {
  const path = req.url.split('?')[0].replace(/\/$/, '');
  const doc = PAGES[path];
  if (!doc) {
    res.status(404).send('Not found');
    return;
  }
  res.setHeader('Content-Type', 'text/html');
  res.send(page(doc));
};

module.exports = withMiddleware(handler, { skipAll: true });
