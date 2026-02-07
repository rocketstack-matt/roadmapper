const { createMockReq, createMockRes, mockIssues } = require('./helpers');

jest.mock('../roadmap', () => ({
  fetchIssues: jest.fn(),
}));

const { fetchIssues } = require('../roadmap');
const htmlHandler = require('../api/html');

const helpers = require('./helpers');

beforeEach(() => {
  jest.clearAllMocks();
  fetchIssues.mockResolvedValue(helpers.mockIssues);
});

describe('api/html', () => {
  test('returns HTML with correct content type', async () => {
    const req = createMockReq('/html/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.headers['Content-Type']).toBe('text/html');
    expect(res.body).toContain('<!DOCTYPE html>');
  });

  test('includes page title with owner/repo', async () => {
    const req = createMockReq('/html/facebook/react/ffffff/24292f');
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.body).toContain('<title>facebook/react - Roadmap HTML</title>');
  });

  test('includes header with owner/repo', async () => {
    const req = createMockReq('/html/facebook/react/ffffff/24292f');
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.body).toContain('HTML Code for facebook/react');
  });

  test('generates image map code with correct image URL for localhost', async () => {
    const req = createMockReq('/html/owner/repo/ffffff/24292f', {
      host: 'localhost:5002'
    });
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.body).toContain('http://localhost:5002/owner/repo/ffffff/24292f');
  });

  test('generates image map code with HTTPS URL for production', async () => {
    const req = createMockReq('/html/owner/repo/ffffff/24292f', {
      host: 'roadmapper.rocketstack.co'
    });
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.body).toContain('https://roadmapper.rocketstack.co/owner/repo/ffffff/24292f');
  });

  test('includes usemap with owner-repo naming', async () => {
    const req = createMockReq('/html/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.body).toContain('usemap="#roadmap-owner-repo"');
    expect(res.body).toContain('name="roadmap-owner-repo"');
  });

  test('generates correct area coords for each column', async () => {
    const req = createMockReq('/html/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await htmlHandler(req, res);

    // Now column (index 0): x1=15, y1=130, x2=365, y2=205
    expect(res.body).toContain('coords="15,130,365,205"');
    // Later column (index 1): x1=395, y1=130, x2=745, y2=205
    expect(res.body).toContain('coords="395,130,745,205"');
    // Future column (index 2): x1=775, y1=130, x2=1125, y2=205
    expect(res.body).toContain('coords="775,130,1125,205"');
  });

  test('includes copy to clipboard functionality', async () => {
    const req = createMockReq('/html/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.body).toContain('function copyCode()');
    expect(res.body).toContain('navigator.clipboard.writeText');
    expect(res.body).toContain('Copy to Clipboard');
  });

  test('includes alternative markdown link section', async () => {
    const req = createMockReq('/html/owner/repo/ffffff/24292f', {
      host: 'localhost:5002'
    });
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.body).toContain('Alternative: Link to Viewer Page');
    expect(res.body).toContain('[![Roadmap]');
  });

  test('includes viewer link in alternative section', async () => {
    const req = createMockReq('/html/owner/repo/ffffff/24292f', {
      host: 'localhost:5002'
    });
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.body).toContain('http://localhost:5002/view/owner/repo/ffffff/24292f');
  });

  test('includes GitHub limitation warning', async () => {
    const req = createMockReq('/html/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.body).toContain('GitHub Limitation');
  });

  test('includes preview section', async () => {
    const req = createMockReq('/html/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.body).toContain('Preview (Try clicking on the cards!)');
  });

  test('includes color presets for theme cycling', async () => {
    const req = createMockReq('/html/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.body).toContain('COLOR_PRESETS');
    expect(res.body).toContain("name: 'Light'");
    expect(res.body).toContain("name: 'Dark'");
    expect(res.body).toContain("name: 'Navy'");
    expect(res.body).toContain("name: 'Forest'");
  });

  test('includes theme toggle and CSS custom properties', async () => {
    const req = createMockReq('/html/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.body).toContain('function toggleTheme()');
    expect(res.body).toContain('--bg-primary');
    expect(res.body).toContain('[data-theme="dark"]');
  });

  test('includes Roadmapper logo', async () => {
    const req = createMockReq('/html/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.body).toContain('/logo.svg');
    expect(res.body).toContain('Roadmapper');
  });

  test('redirects 2-parameter format to default colors', async () => {
    const req = createMockReq('/html/owner/repo');
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.redirectStatus).toBe(301);
    expect(res.redirectUrl).toBe('/html/owner/repo/ffffff/24292f');
  });

  test('returns 400 for invalid URL format', async () => {
    const req = createMockReq('/html/');
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('Invalid URL format');
  });

  test('returns 500 when fetchIssues fails', async () => {
    fetchIssues.mockRejectedValue(new Error('API Error'));
    const req = createMockReq('/html/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toContain('Error fetching GitHub issues');
  });

  test('escapes HTML entities in code block display', async () => {
    const req = createMockReq('/html/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await htmlHandler(req, res);

    // The code display section should have escaped HTML
    expect(res.body).toContain('&lt;img');
    expect(res.body).toContain('&lt;map');
  });

  test('escapes quotes in issue titles for alt attributes', async () => {
    const issueWithQuotes = [{
      number: 1,
      title: 'Feature "with quotes"',
      html_url: 'https://github.com/owner/repo/issues/1',
      labels: [{ name: 'Roadmap: Now', color: '2da44e' }]
    }];
    fetchIssues.mockResolvedValue(issueWithQuotes);

    const req = createMockReq('/html/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.body).toContain('&quot;');
  });

  test('handles trailing slash in URL', async () => {
    const req = createMockReq('/html/owner/repo/ffffff/24292f/');
    const res = createMockRes();

    await htmlHandler(req, res);

    expect(res.headers['Content-Type']).toBe('text/html');
  });
});
