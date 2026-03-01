const handler = require('../api/github/setup');
const { createMockReq, createMockRes } = require('./helpers');

describe('api/github/setup', () => {
  test('redirects to landing page with success parameter', async () => {
    const req = createMockReq('/api/github/setup?installation_id=123&setup_action=install');
    const res = createMockRes();
    await handler(req, res);

    expect(res.redirectStatus).toBe(302);
    expect(res.redirectUrl).toBe('http://localhost:5002/?github_app=installed');
  });

  test('uses https for non-localhost host', async () => {
    const req = createMockReq('/api/github/setup', { host: 'roadmapper.rocketstack.co' });
    const res = createMockRes();
    await handler(req, res);

    expect(res.redirectUrl).toBe('https://roadmapper.rocketstack.co/?github_app=installed');
  });

  test('defaults host when header missing', async () => {
    const req = { url: '/api/github/setup', headers: {} };
    const res = createMockRes();
    await handler(req, res);

    expect(res.redirectUrl).toBe('https://roadmapper.rocketstack.co/?github_app=installed');
  });
});
