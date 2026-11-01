const { createMockReq, createMockRes } = require('./helpers');
const legalHandler = require('../api/legal');

const render = async (url) => {
  const res = createMockRes();
  await legalHandler(createMockReq(url), res);
  return res;
};

describe('api/legal', () => {
  test('serves the privacy policy at /privacy', async () => {
    const res = await render('/privacy');

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/html');
    expect(res.body).toContain('<h1>Privacy Policy</h1>');
    expect(res.body).toContain('Westwood Hill (CP) Ltd, trading as Rocketstack');
    expect(res.body).toContain('href="mailto:matt@rocketstack.co"');
  });

  test('serves the terms of service at /terms, with or without a trailing slash', async () => {
    for (const url of ['/terms', '/terms/', '/terms?ref=marketplace']) {
      const res = await render(url);
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('<h1>Terms of Service</h1>');
      expect(res.body).toContain('England and Wales');
    }
  });

  test('links each page to the other', async () => {
    const res = await render('/privacy');
    expect(res.body).toContain('href="/terms"');
  });

  test('returns 404 for any other path', async () => {
    const res = await render('/legal');
    expect(res.statusCode).toBe(404);
  });
});

describe('landing page footer', () => {
  test('links to the privacy policy and terms', async () => {
    const indexHandler = require('../api/index');
    const res = createMockRes();
    await indexHandler(createMockReq('/'), res);
    expect(res.body).toContain('<a href="/privacy">Privacy</a>');
    expect(res.body).toContain('<a href="/terms">Terms</a>');
  });
});
