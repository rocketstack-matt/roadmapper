const { createMockReq, createMockRes } = require('./helpers');
const indexHandler = require('../api/index');

describe('api/index', () => {
  test('returns HTML with correct content type', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.headers['Content-Type']).toBe('text/html');
    expect(res.body).toContain('<!DOCTYPE html>');
  });

  test('includes page title', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('<title>Roadmapper - GitHub Issue Roadmaps Made Simple</title>');
  });

  test('includes hero section', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('GitHub Issue Roadmaps Made Simple');
    expect(res.body).toContain('Get Started');
  });

  test('includes How It Works section', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('How It Works');
    expect(res.body).toContain('Label Your Issues');
    expect(res.body).toContain('Generate Your Roadmap');
    expect(res.body).toContain('Share Anywhere');
  });

  test('includes label names with correct styling', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('Roadmap: Now');
    expect(res.body).toContain('Roadmap: Next');
    expect(res.body).toContain('Roadmap: Later');
  });

  test('includes live example with embedded iframe', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('Live Example');
    expect(res.body).toContain('<iframe');
    expect(res.body).toContain('id="roadmap-iframe"');
    expect(res.body).toContain('/embed/rocketstack-matt/roadmapper/ffffff/24292f');
  });

  test('includes URL format documentation', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('Embed your roadmap');
    expect(res.body).toContain('{owner}');
    expect(res.body).toContain('{repo}');
    expect(res.body).toContain('{bgColor}');
    expect(res.body).toContain('{textColor}');
  });

  test('includes three embedding options', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('GitHub README');
    expect(res.body).toContain('Website (iframe)');
    expect(res.body).toContain('HTML Image Map');
  });

  test('includes embed option tabs with JavaScript', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('function showEmbedOption(option)');
    expect(res.body).toContain('embed-github');
    expect(res.body).toContain('embed-iframe');
    expect(res.body).toContain('embed-html');
  });

  test('includes features section', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('Features');
    expect(res.body).toContain('Label Colors');
    expect(res.body).toContain('Auto Updates');
    expect(res.body).toContain('Per-Repo Keys');
    expect(res.body).toContain('Fast & Cached');
    expect(res.body).toContain('Clickable Cards');
    expect(res.body).toContain('Issue Grouping');
  });

  test('includes footer with attribution', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('@rocketstack-matt');
    expect(res.body).toContain('/rocketstack-matt.png');
  });

  test('includes theme toggle functionality', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('function toggleTheme()');
    expect(res.body).toContain('function updateThemeButton(theme)');
    expect(res.body).toContain('localStorage');
  });

  test('toggleTheme updates embedded roadmap iframe colors', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('function updateRoadmapTheme(theme)');
    expect(res.body).toContain("getElementById('roadmap-iframe')");
    expect(res.body).toContain("bg: '0d1117', text: 'e6edf3'");
    expect(res.body).toContain("bg: 'ffffff', text: '24292f'");
  });

  test('initializes roadmap iframe colors based on saved theme', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('updateRoadmapTheme(savedTheme)');
  });

  test('includes CSS custom properties for theming', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('--bg-primary');
    expect(res.body).toContain('--text-primary');
    expect(res.body).toContain('[data-theme="dark"]');
  });

  test('includes logo', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('/logo.svg');
    expect(res.body).toContain('Roadmapper');
  });

  test('includes links to GitHub repo', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('https://github.com/rocketstack-matt/roadmapper');
  });

  test('includes responsive styles', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('@media (max-width: 768px)');
  });

  test('includes steps-2-3 wrapper div', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('id="steps-2-3"');
  });

  test('includes onPageLoad function for confirmation handling', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('function onPageLoad()');
    expect(res.body).toContain('onPageLoad()');
  });

  test('onPageLoad checks for confirmation query params', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain("params.get('confirmed')");
    expect(res.body).toContain("params.get('confirm_error')");
  });

  test('onPageLoad cleans URL with history.replaceState', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain("history.replaceState(null, '', '/')");
  });

  test('includes CSS for confirmation banner', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('.result-confirmed');
  });

  test('steps 2-3 are hidden by default', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('id="steps-2-3" style="display: none;"');
  });

  test('handleRegister shows steps 2-3 when no pending confirmation', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain("getElementById('steps-2-3')");
  });
});
