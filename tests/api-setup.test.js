jest.mock('../lib/github-app', () => ({
  ...jest.requireActual('../lib/github-app'),
  getInstallationRepos: jest.fn(),
  getInstallationTier: jest.fn(),
}));

const { createMockReq, createMockRes } = require('./helpers');
const { getInstallationRepos, getInstallationTier } = require('../lib/github-app');
const setupHandler = require('../api/setup');

const originalEnv = process.env;

const installation = (repositories, account = 'acme') => ({ account, repositories });

const render = async (url) => {
  const res = createMockRes();
  await setupHandler(createMockReq(url), res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv, GITHUB_APP_ID: '1', GITHUB_APP_PRIVATE_KEY: 'key' };
  delete process.env.GITHUB_APP_WEBHOOK_SECRET;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  getInstallationTier.mockResolvedValue('free');
});

afterAll(() => {
  process.env = originalEnv;
});

describe('api/setup', () => {
  test('lists the public repos of the installation with their embed URLs', async () => {
    getInstallationRepos.mockResolvedValue(installation([
      { owner: 'acme', repo: 'widgets', private: false },
      { owner: 'acme', repo: 'gadgets', private: false },
    ]));

    const res = await render('/setup?installation_id=42&setup_action=install');

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/html');
    expect(getInstallationRepos).toHaveBeenCalledWith('42');
    expect(getInstallationTier).toHaveBeenCalledWith('42');
    expect(res.body).toContain('<strong>acme</strong>');
    expect(res.body).toContain('acme/widgets');
    expect(res.body).toContain('acme/gadgets');
    expect(res.body).toContain('[![Roadmap](http://localhost:5002/acme/widgets/ffffff/24292f)](http://localhost:5002/view/acme/widgets/ffffff/24292f)');
    expect(res.body).toContain('&lt;iframe src=&quot;http://localhost:5002/embed/acme/widgets/ffffff/24292f&quot;');
    expect(res.body).toContain('href="http://localhost:5002/html/acme/gadgets/ffffff/24292f"');
  });

  test('uses https for non-localhost hosts', async () => {
    getInstallationRepos.mockResolvedValue(installation([{ owner: 'acme', repo: 'widgets', private: false }]));
    const res = createMockRes();
    await setupHandler(createMockReq('/setup?installation_id=42', { host: 'roadmapper.rocketstack.co' }), res);

    expect(res.body).toContain('https://roadmapper.rocketstack.co/view/acme/widgets/ffffff/24292f');
  });

  test('counts private repos without naming them', async () => {
    getInstallationRepos.mockResolvedValue(installation([
      { owner: 'acme', repo: 'widgets', private: false },
      { owner: 'acme', repo: 'secret-plans', private: true },
    ]));

    const res = await render('/setup?installation_id=42');

    expect(res.body).not.toContain('secret-plans');
    expect(res.body).toContain('1 private repository is not shown');
  });

  test('explains when no public repos are connected', async () => {
    getInstallationRepos.mockResolvedValue(installation([{ owner: 'acme', repo: 'secret', private: true }]));

    const res = await render('/setup?installation_id=42');

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('No public repositories are connected yet');
  });

  test('free installs are told they refresh hourly', async () => {
    getInstallationRepos.mockResolvedValue(installation([]));

    const res = await render('/setup?installation_id=42');

    expect(res.body).toContain('Free plan:');
    expect(res.body).toContain('refresh hourly');
  });

  test('paid installs with webhooks configured get live updates', async () => {
    process.env.GITHUB_APP_WEBHOOK_SECRET = 'secret';
    getInstallationTier.mockResolvedValue('paid');
    getInstallationRepos.mockResolvedValue(installation([]));

    const res = await render('/setup?installation_id=42');

    expect(res.body).toContain('Paid plan:');
    expect(res.body).not.toContain('Free plan:');
  });

  test('escapes names from GitHub', async () => {
    getInstallationRepos.mockResolvedValue(installation([{ owner: 'acme', repo: '<b>x</b>', private: false }], '<i>acme</i>'));

    const res = await render('/setup?installation_id=42');

    expect(res.body).not.toContain('<b>x</b>');
    expect(res.body).not.toContain('<i>acme</i>');
    expect(res.body).toContain('&lt;i&gt;acme&lt;/i&gt;');
  });

  test('an install request awaiting org approval needs no installation id', async () => {
    const res = await render('/setup?setup_action=request');

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Installation requested');
    expect(getInstallationRepos).not.toHaveBeenCalled();
  });

  test('400 for a missing or non-numeric installation id', async () => {
    expect((await render('/setup')).statusCode).toBe(400);
    expect((await render('/setup?installation_id=42abc')).statusCode).toBe(400);
    expect(getInstallationRepos).not.toHaveBeenCalled();
  });

  test('404 for an unknown installation', async () => {
    getInstallationRepos.mockResolvedValue(null);

    const res = await render('/setup?installation_id=42');

    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('Installation not found');
  });

  test('502 when GitHub cannot be reached', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    getInstallationRepos.mockRejectedValue(new Error('boom'));

    const res = await render('/setup?installation_id=42');

    expect(res.statusCode).toBe(502);
    console.error.mockRestore();
  });

  test('404 when the App is not configured', async () => {
    delete process.env.GITHUB_APP_ID;

    const res = await render('/setup?installation_id=42');

    expect(res.statusCode).toBe(404);
    expect(getInstallationRepos).not.toHaveBeenCalled();
  });
});
