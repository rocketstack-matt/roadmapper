const { createMockReq, createMockRes, mockIssues } = require('./helpers');

jest.mock('../roadmap', () => ({
  generateRoadmapSVG: jest.fn(() => '<svg>mock</svg>'),
  fetchIssues: jest.fn(() => Promise.resolve(mockIssues)),
}));

const { generateRoadmapSVG, fetchIssues } = require('../roadmap');
const roadmapHandler = require('../api/roadmap');

// Re-import mockIssues so mock can reference it
const helpers = require('./helpers');

beforeEach(() => {
  jest.clearAllMocks();
  fetchIssues.mockResolvedValue(helpers.mockIssues);
  generateRoadmapSVG.mockReturnValue('<svg>mock</svg>');
});

describe('api/roadmap', () => {
  test('returns SVG content with correct content type', async () => {
    const req = createMockReq('/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await roadmapHandler(req, res);

    expect(res.headers['Content-Type']).toBe('image/svg+xml');
    expect(res.body).toBe('<svg>mock</svg>');
  });

  test('calls fetchIssues with correct owner and repo', async () => {
    const req = createMockReq('/facebook/react/ffffff/24292f');
    const res = createMockRes();

    await roadmapHandler(req, res);

    expect(fetchIssues).toHaveBeenCalledWith('facebook', 'react', undefined);
  });

  test('passes bgColor and textColor to generateRoadmapSVG', async () => {
    const req = createMockReq('/owner/repo/ff0000/00ff00');
    const res = createMockRes();

    await roadmapHandler(req, res);

    expect(generateRoadmapSVG).toHaveBeenCalledWith(
      helpers.mockIssues,
      'ff0000',
      '00ff00'
    );
  });

  test('redirects 2-parameter format to default colors', async () => {
    const req = createMockReq('/owner/repo');
    const res = createMockRes();

    await roadmapHandler(req, res);

    expect(res.redirectStatus).toBe(301);
    expect(res.redirectUrl).toBe('/owner/repo/ffffff/24292f');
  });

  test('returns 400 for invalid URL format', async () => {
    const req = createMockReq('/');
    const res = createMockRes();

    await roadmapHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('Invalid URL format');
  });

  test('returns 500 when fetchIssues fails', async () => {
    fetchIssues.mockRejectedValue(new Error('GitHub API error'));
    const req = createMockReq('/owner/repo/ffffff/24292f');
    const res = createMockRes();

    await roadmapHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toContain('Error fetching GitHub issues');
  });

  test('handles trailing slash in URL', async () => {
    const req = createMockReq('/owner/repo/ffffff/24292f/');
    const res = createMockRes();

    await roadmapHandler(req, res);

    expect(fetchIssues).toHaveBeenCalledWith('owner', 'repo', undefined);
    expect(res.headers['Content-Type']).toBe('image/svg+xml');
  });
});
