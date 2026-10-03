const { createMockReq, createMockRes, mockIssues } = require('./helpers');

jest.mock('../roadmap', () => {
  const actual = jest.requireActual('../roadmap');
  return {
    ...actual,
    fetchIssues: jest.fn(),
  };
});

const { fetchIssues } = require('../roadmap');
const indexHandler = require('../api/index');
const viewHandler = require('../api/view');
const embedHandler = require('../api/embed');
const htmlHandler = require('../api/html');
const { errorHtml } = require('../lib/middleware');

// Every HTML page (including the middleware's error pages) includes the Google
// Analytics snippet; each must use the trimmed measurement ID so a stray
// newline in the env value can't break it.
describe('Google Analytics snippet on HTML pages', () => {
  const originalId = process.env.GA_MEASUREMENT_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchIssues.mockResolvedValue(mockIssues);
    process.env.GA_MEASUREMENT_ID = 'G-TEST123\n';
  });

  afterEach(() => {
    if (originalId === undefined) delete process.env.GA_MEASUREMENT_ID;
    else process.env.GA_MEASUREMENT_ID = originalId;
  });

  test('landing page uses the trimmed measurement ID', async () => {
    const res = createMockRes();
    await indexHandler(createMockReq('/'), res);
    expect(res.body).toContain("gtag('config','G-TEST123');");
  });

  test('viewer page uses the trimmed measurement ID', async () => {
    const res = createMockRes();
    await viewHandler(createMockReq('/view/owner/repo/ffffff/24292f'), res);
    expect(res.body).toContain("gtag('config','G-TEST123');");
  });

  test('embed page uses the trimmed measurement ID', async () => {
    const res = createMockRes();
    await embedHandler(createMockReq('/embed/owner/repo/ffffff/24292f'), res);
    expect(res.body).toContain("gtag('config','G-TEST123');");
  });

  test('html page uses the trimmed measurement ID', async () => {
    const res = createMockRes();
    await htmlHandler(createMockReq('/html/owner/repo/ffffff/24292f'), res);
    expect(res.body).toContain("gtag('config','G-TEST123');");
  });

  test('middleware error page uses the trimmed measurement ID', () => {
    expect(errorHtml('Repository not registered', 'Register at roadmapper.rocketstack.co')).toContain("gtag('config','G-TEST123');");
  });
});
