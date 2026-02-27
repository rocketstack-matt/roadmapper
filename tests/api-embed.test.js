const { createMockReq, createMockRes, mockIssues } = require('./helpers');

jest.mock('../roadmap', () => {
  const actual = jest.requireActual('../roadmap');
  return {
    ...actual,
    fetchIssues: jest.fn(),
  };
});

const { fetchIssues } = require('../roadmap');
const embedHandler = require('../api/embed');

const helpers = require('./helpers');

beforeEach(() => {
  jest.clearAllMocks();
  fetchIssues.mockResolvedValue(helpers.mockIssues);
});

describe('api/embed', () => {
  test('returns HTML with correct content type', async () => {
    const req = createMockReq('/embed/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await embedHandler(req, res);

    expect(res.headers['Content-Type']).toBe('text/html');
    expect(res.body).toContain('<!DOCTYPE html>');
  });

  test('includes image with correct SVG URL for localhost', async () => {
    const req = createMockReq('/embed/owner/repo/ffffff/24292f', {
      host: 'localhost:5002'
    });
    const res = createMockRes();

    await embedHandler(req, res);

    expect(res.body).toContain('src="http://localhost:5002/owner/repo/ffffff/24292f"');
  });

  test('includes image with HTTPS URL for production', async () => {
    const req = createMockReq('/embed/owner/repo/ffffff/24292f', {
      host: 'roadmapper.rocketstack.co'
    });
    const res = createMockRes();

    await embedHandler(req, res);

    expect(res.body).toContain('src="https://roadmapper.rocketstack.co/owner/repo/ffffff/24292f"');
  });

  test('generates image map areas for Now column', async () => {
    const req = createMockReq('/embed/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await embedHandler(req, res);

    // Now column (columnIndex=0): x1=15, y1=130, x2=365, y2=205
    expect(res.body).toContain('coords="15,130,365,205"');
    expect(res.body).toContain('href="https://github.com/owner/repo/issues/1"');
  });

  test('generates image map areas for Next column', async () => {
    const req = createMockReq('/embed/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await embedHandler(req, res);

    // Next column (columnIndex=1): x1=395, y1=130, x2=745, y2=205
    expect(res.body).toContain('coords="395,130,745,205"');
    expect(res.body).toContain('href="https://github.com/owner/repo/issues/2"');
  });

  test('generates image map areas for Later column', async () => {
    const req = createMockReq('/embed/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await embedHandler(req, res);

    // Later column (columnIndex=2): x1=775, y1=130, x2=1125, y2=205
    expect(res.body).toContain('coords="775,130,1125,205"');
    expect(res.body).toContain('href="https://github.com/owner/repo/issues/3"');
  });

  test('includes usemap attribute on image', async () => {
    const req = createMockReq('/embed/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await embedHandler(req, res);

    expect(res.body).toContain('usemap="#roadmap"');
    expect(res.body).toContain('<map name="roadmap">');
  });

  test('sets target="_blank" on all area links', async () => {
    const req = createMockReq('/embed/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await embedHandler(req, res);

    const areaMatches = res.body.match(/target="_blank"/g);
    expect(areaMatches).not.toBeNull();
    expect(areaMatches.length).toBeGreaterThanOrEqual(3);
  });

  test('redirects 2-parameter format to default colors', async () => {
    const req = createMockReq('/embed/owner/repo');
    const res = createMockRes();

    await embedHandler(req, res);

    expect(res.redirectStatus).toBe(301);
    expect(res.redirectUrl).toBe('/embed/owner/repo/ffffff/24292f');
  });

  test('returns 400 for invalid URL format', async () => {
    const req = createMockReq('/embed/');
    const res = createMockRes();

    await embedHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('Invalid URL format');
  });

  test('returns 500 when fetchIssues fails', async () => {
    fetchIssues.mockRejectedValue(new Error('API Error'));
    const req = createMockReq('/embed/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await embedHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toContain('Error fetching GitHub issues');
  });

  test('handles empty issues array', async () => {
    fetchIssues.mockResolvedValue([]);
    const req = createMockReq('/embed/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await embedHandler(req, res);

    expect(res.headers['Content-Type']).toBe('text/html');
    expect(res.body).toContain('<map name="roadmap">');
  });

  test('sorts issues by number', async () => {
    const unsortedIssues = [
      helpers.createMockIssue(3, 'Third', 'Roadmap: Now', '2da44e'),
      helpers.createMockIssue(1, 'First', 'Roadmap: Now', '2da44e'),
    ];
    fetchIssues.mockResolvedValue(unsortedIssues);
    const req = createMockReq('/embed/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await embedHandler(req, res);

    const firstIdx = res.body.indexOf('issues/1');
    const thirdIdx = res.body.indexOf('issues/3');
    expect(firstIdx).toBeLessThan(thirdIdx);
  });

  test('handles trailing slash in URL', async () => {
    const req = createMockReq('/embed/owner/repo/ffffff/24292f/');
    const res = createMockRes();

    await embedHandler(req, res);

    expect(res.headers['Content-Type']).toBe('text/html');
  });

  test('includes postMessage script for parent iframe resizing', async () => {
    const req = createMockReq('/embed/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await embedHandler(req, res);

    expect(res.body).toContain('function sendSize()');
    expect(res.body).toContain("postMessage");
    expect(res.body).toContain("'roadmap-resize'");
    expect(res.body).toContain('img.offsetHeight');
  });

  test('offsets card coordinates for grouped issues', async () => {
    const groupedIssues = [
      { number: 1, title: 'Grouped Card', html_url: 'https://github.com/owner/repo/issues/1', labels: [
        { name: 'Roadmap: Now', color: '2da44e' },
        { name: 'Roadmap Group: Frontend', color: 'ff0000' }
      ]},
    ];
    fetchIssues.mockResolvedValue(groupedIssues);
    const req = createMockReq('/embed/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await embedHandler(req, res);

    // Now column (columnIndex=0): group header adds 35px
    // Card y1 = 130 (column header) + 35 (group header) = 165
    // Card y2 = 165 + 75 = 240
    expect(res.body).toContain('coords="15,165,365,240"');
  });

  test('coordinates for ungrouped issues after groups', async () => {
    const mixedIssues = [
      { number: 1, title: 'Grouped', html_url: 'https://github.com/owner/repo/issues/1', labels: [
        { name: 'Roadmap: Now', color: '2da44e' },
        { name: 'Roadmap Group: Team A', color: 'ff0000' }
      ]},
      { number: 2, title: 'Ungrouped', html_url: 'https://github.com/owner/repo/issues/2', labels: [
        { name: 'Roadmap: Now', color: '2da44e' }
      ]},
    ];
    fetchIssues.mockResolvedValue(mixedIssues);
    const req = createMockReq('/embed/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await embedHandler(req, res);

    // Grouped card: y1 = 130 + 35 = 165, y2 = 240
    expect(res.body).toContain('coords="15,165,365,240"');
    // Global layout: Team A band ends at 130+35+95=260, gap=10, Other band yStart=270
    // Ungrouped card: y1 = 270 (Other band) + 35 (Other header) = 305, y2 = 305+75 = 380
    expect(res.body).toContain('coords="15,305,365,380"');
  });
});
