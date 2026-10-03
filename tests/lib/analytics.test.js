jest.mock('https', () => ({
  request: jest.fn(() => ({ on: jest.fn(), write: jest.fn(), end: jest.fn() })),
}));

const https = require('https');
const { gaSnippet, trackEvent } = require('../../lib/analytics');

describe('trackEvent', () => {
  const originalId = process.env.GA_MEASUREMENT_ID;
  const originalSecret = process.env.GA_API_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalId === undefined) delete process.env.GA_MEASUREMENT_ID;
    else process.env.GA_MEASUREMENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.GA_API_SECRET;
    else process.env.GA_API_SECRET = originalSecret;
  });

  test('sends the trimmed measurement ID to the Measurement Protocol', () => {
    process.env.GA_MEASUREMENT_ID = 'G-TEST123\n';
    process.env.GA_API_SECRET = 'secret';

    trackEvent('roadmap_view');

    const url = https.request.mock.calls[0][0];
    expect(url.searchParams.get('measurement_id')).toBe('G-TEST123');
  });

  test('does not send when the measurement ID is only whitespace', () => {
    process.env.GA_MEASUREMENT_ID = ' \n';
    process.env.GA_API_SECRET = 'secret';

    trackEvent('roadmap_view');

    expect(https.request).not.toHaveBeenCalled();
  });
});

describe('gaSnippet', () => {
  const originalId = process.env.GA_MEASUREMENT_ID;

  afterEach(() => {
    if (originalId === undefined) delete process.env.GA_MEASUREMENT_ID;
    else process.env.GA_MEASUREMENT_ID = originalId;
  });

  test('returns an empty string when GA_MEASUREMENT_ID is not set', () => {
    delete process.env.GA_MEASUREMENT_ID;
    expect(gaSnippet()).toBe('');
  });

  test('returns an empty string when GA_MEASUREMENT_ID is only whitespace', () => {
    process.env.GA_MEASUREMENT_ID = ' \n';
    expect(gaSnippet()).toBe('');
  });

  test('includes the measurement ID in the loader URL and config call', () => {
    process.env.GA_MEASUREMENT_ID = 'G-TEST123';
    const snippet = gaSnippet();
    expect(snippet).toContain('src="https://www.googletagmanager.com/gtag/js?id=G-TEST123"');
    expect(snippet).toContain("gtag('config','G-TEST123');");
  });

  test('trims surrounding whitespace from the measurement ID', () => {
    process.env.GA_MEASUREMENT_ID = '  G-TEST123\n';
    const snippet = gaSnippet();
    expect(snippet).toContain('src="https://www.googletagmanager.com/gtag/js?id=G-TEST123"');
    expect(snippet).toContain("gtag('config','G-TEST123');");
  });

  test('inline script is valid JavaScript when the ID has a trailing newline', () => {
    // A trailing newline in the env value split the config call's string
    // literal across lines, a syntax error that stopped analytics loading.
    process.env.GA_MEASUREMENT_ID = 'G-TEST123\n';
    const inlineScript = gaSnippet().match(/<script>([\s\S]*?)<\/script>/)[1];
    expect(() => new Function(inlineScript)).not.toThrow();
  });
});
