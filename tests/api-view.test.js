const { createMockReq, createMockRes } = require('./helpers');
const viewHandler = require('../api/view');

describe('api/view', () => {
  test('returns HTML with correct content type', async () => {
    const req = createMockReq('/view/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await viewHandler(req, res);

    expect(res.headers['Content-Type']).toBe('text/html');
    expect(res.body).toContain('<!DOCTYPE html>');
  });

  test('includes owner/repo in page title', async () => {
    const req = createMockReq('/view/facebook/react/ffffff/24292f');
    const res = createMockRes();

    await viewHandler(req, res);

    expect(res.body).toContain('<title>facebook/react - Roadmap</title>');
  });

  test('includes owner/repo in header', async () => {
    const req = createMockReq('/view/facebook/react/ffffff/24292f');
    const res = createMockRes();

    await viewHandler(req, res);

    expect(res.body).toContain('<h1>facebook/react</h1>');
  });

  test('includes link to GitHub repo', async () => {
    const req = createMockReq('/view/facebook/react/ffffff/24292f');
    const res = createMockRes();

    await viewHandler(req, res);

    expect(res.body).toContain('https://github.com/facebook/react');
  });

  test('embeds SVG with correct URL for localhost', async () => {
    const req = createMockReq('/view/owner/repo/ffffff/24292f', {
      host: 'localhost:5002'
    });
    const res = createMockRes();

    await viewHandler(req, res);

    expect(res.body).toContain('http://localhost:5002/owner/repo/ffffff/24292f');
  });

  test('embeds SVG with HTTPS for production', async () => {
    const req = createMockReq('/view/owner/repo/ffffff/24292f', {
      host: 'roadmapper.rocketstack.co'
    });
    const res = createMockRes();

    await viewHandler(req, res);

    expect(res.body).toContain('https://roadmapper.rocketstack.co/owner/repo/ffffff/24292f');
  });

  test('uses default host when none provided', async () => {
    const req = { url: '/view/owner/repo/ffffff/24292f', headers: {} };
    const res = createMockRes();

    await viewHandler(req, res);

    expect(res.body).toContain('https://roadmapper.rocketstack.co/owner/repo/ffffff/24292f');
  });

  test('redirects 2-parameter format to default colors', async () => {
    const req = createMockReq('/view/owner/repo');
    const res = createMockRes();

    await viewHandler(req, res);

    expect(res.redirectStatus).toBe(301);
    expect(res.redirectUrl).toBe('/view/owner/repo/ffffff/24292f');
  });

  test('returns 400 for invalid URL format', async () => {
    const req = createMockReq('/view/');
    const res = createMockRes();

    await viewHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('Invalid URL format');
  });

  test('includes color presets in page script', async () => {
    const req = createMockReq('/view/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await viewHandler(req, res);

    expect(res.body).toContain('COLOR_PRESETS');
    expect(res.body).toContain("name: 'Light'");
    expect(res.body).toContain("name: 'Dark'");
    expect(res.body).toContain("name: 'GitHub'");
    expect(res.body).toContain("name: 'Navy'");
    expect(res.body).toContain("name: 'Forest'");
  });

  test('includes theme toggle functionality', async () => {
    const req = createMockReq('/view/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await viewHandler(req, res);

    expect(res.body).toContain('function toggleTheme()');
    expect(res.body).toContain('function updatePresetButton()');
    expect(res.body).toContain('localStorage');
  });

  test('includes CSS custom properties for theming', async () => {
    const req = createMockReq('/view/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await viewHandler(req, res);

    expect(res.body).toContain('--bg-primary');
    expect(res.body).toContain('--text-primary');
    expect(res.body).toContain('[data-theme="dark"]');
  });

  test('includes Roadmapper logo', async () => {
    const req = createMockReq('/view/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await viewHandler(req, res);

    expect(res.body).toContain('/logo.svg');
    expect(res.body).toContain('Roadmapper');
  });

  test('handles trailing slash in URL', async () => {
    const req = createMockReq('/view/owner/repo/ffffff/24292f/');
    const res = createMockRes();

    await viewHandler(req, res);

    expect(res.headers['Content-Type']).toBe('text/html');
    expect(res.body).toContain('<h1>owner/repo</h1>');
  });

  test('passes bgColor and textColor to client-side script', async () => {
    const req = createMockReq('/view/owner/repo/ff0000/00ff00');
    const res = createMockRes();

    await viewHandler(req, res);

    expect(res.body).toContain("const currentBg = 'ff0000'");
    expect(res.body).toContain("const currentText = '00ff00'");
  });
});
