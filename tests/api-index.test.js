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
    expect(res.body).toContain('Roadmap: Later');
    expect(res.body).toContain('Roadmap: Future');
  });

  test('includes live example with embedded iframe', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('Live Example');
    expect(res.body).toContain('<iframe');
    expect(res.body).toContain('/embed/rocketstack-matt/roadmapper/ffffff/24292f');
  });

  test('includes URL format documentation', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await indexHandler(req, res);

    expect(res.body).toContain('Your Roadmap URL');
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
    expect(res.body).toContain('Clean Design');
    expect(res.body).toContain('Label Colors');
    expect(res.body).toContain('Real-time Updates');
    expect(res.body).toContain('No Auth Required');
    expect(res.body).toContain('Fast & Serverless');
    expect(res.body).toContain('Clickable Cards');
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
});
