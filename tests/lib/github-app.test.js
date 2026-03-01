jest.mock('../../lib/redis', () => ({
  get: jest.fn(() => Promise.resolve(null)),
  set: jest.fn(() => Promise.resolve('OK')),
  del: jest.fn(() => Promise.resolve(0)),
}));

jest.mock('axios');
jest.mock('jsonwebtoken');

const redis = require('../../lib/redis');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const {
  isGitHubAppConfigured,
  generateAppJwt,
  getInstallationId,
  getInstallationToken,
  getTokenForRepo,
  decodePrivateKey,
} = require('../../lib/github-app');

const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv };
  delete process.env.GITHUB_APP_ID;
  delete process.env.GITHUB_APP_PRIVATE_KEY;
  delete process.env.GITHUB_APP_WEBHOOK_SECRET;
});

afterAll(() => {
  process.env = originalEnv;
});

describe('lib/github-app', () => {
  describe('isGitHubAppConfigured', () => {
    test('returns false when env vars not set', () => {
      expect(isGitHubAppConfigured()).toBe(false);
    });

    test('returns false when only APP_ID is set', () => {
      process.env.GITHUB_APP_ID = '12345';
      expect(isGitHubAppConfigured()).toBe(false);
    });

    test('returns false when only PRIVATE_KEY is set', () => {
      process.env.GITHUB_APP_PRIVATE_KEY = 'key';
      expect(isGitHubAppConfigured()).toBe(false);
    });

    test('returns true when both are set', () => {
      process.env.GITHUB_APP_ID = '12345';
      process.env.GITHUB_APP_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
      expect(isGitHubAppConfigured()).toBe(true);
    });
  });

  describe('decodePrivateKey', () => {
    test('returns null when PRIVATE_KEY not set', () => {
      expect(decodePrivateKey()).toBeNull();
    });

    test('returns PEM directly when it starts with BEGIN', () => {
      process.env.GITHUB_APP_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
      expect(decodePrivateKey()).toBe('-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----');
    });

    test('decodes base64-encoded PEM', () => {
      const pem = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
      process.env.GITHUB_APP_PRIVATE_KEY = Buffer.from(pem).toString('base64');
      expect(decodePrivateKey()).toBe(pem);
    });
  });

  describe('generateAppJwt', () => {
    test('returns null when private key not set', () => {
      expect(generateAppJwt()).toBeNull();
    });

    test('generates JWT with correct parameters', () => {
      process.env.GITHUB_APP_ID = '12345';
      process.env.GITHUB_APP_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
      jwt.sign.mockReturnValue('mock-jwt');

      const result = generateAppJwt();

      expect(result).toBe('mock-jwt');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ iss: '12345' }),
        '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
        { algorithm: 'RS256' }
      );
    });

    test('sets iat 60s in the past and exp 10 min in the future', () => {
      process.env.GITHUB_APP_ID = '12345';
      process.env.GITHUB_APP_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
      jwt.sign.mockReturnValue('mock-jwt');

      const before = Math.floor(Date.now() / 1000);
      generateAppJwt();
      const after = Math.floor(Date.now() / 1000);

      const payload = jwt.sign.mock.calls[0][0];
      expect(payload.iat).toBeGreaterThanOrEqual(before - 61);
      expect(payload.iat).toBeLessThanOrEqual(after - 59);
      expect(payload.exp).toBeGreaterThanOrEqual(before + 599);
      expect(payload.exp).toBeLessThanOrEqual(after + 601);
    });
  });

  describe('getInstallationId', () => {
    test('returns cached installation ID', async () => {
      redis.get.mockResolvedValue('42');
      const result = await getInstallationId('owner', 'repo');
      expect(result).toBe('42');
      expect(axios.get).not.toHaveBeenCalled();
    });

    test('fetches from GitHub when not cached', async () => {
      process.env.GITHUB_APP_ID = '12345';
      process.env.GITHUB_APP_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
      jwt.sign.mockReturnValue('mock-jwt');
      redis.get.mockResolvedValue(null);
      axios.get.mockResolvedValue({ data: { id: 99 } });

      const result = await getInstallationId('owner', 'repo');

      expect(result).toBe('99');
      expect(axios.get).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/installation',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer mock-jwt' }),
        })
      );
      expect(redis.set).toHaveBeenCalledWith('gh-app:installation:owner/repo', '99');
    });

    test('returns null when GitHub returns error', async () => {
      process.env.GITHUB_APP_ID = '12345';
      process.env.GITHUB_APP_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
      jwt.sign.mockReturnValue('mock-jwt');
      redis.get.mockResolvedValue(null);
      axios.get.mockRejectedValue(new Error('Not found'));

      const result = await getInstallationId('owner', 'repo');
      expect(result).toBeNull();
    });

    test('returns null when no JWT can be generated', async () => {
      redis.get.mockResolvedValue(null);
      const result = await getInstallationId('owner', 'repo');
      expect(result).toBeNull();
    });
  });

  describe('getInstallationToken', () => {
    test('returns cached token', async () => {
      redis.get.mockResolvedValue('cached-token');
      const result = await getInstallationToken('42');
      expect(result).toBe('cached-token');
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('exchanges JWT for new token', async () => {
      process.env.GITHUB_APP_ID = '12345';
      process.env.GITHUB_APP_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
      jwt.sign.mockReturnValue('mock-jwt');
      redis.get.mockResolvedValue(null);
      axios.post.mockResolvedValue({ data: { token: 'new-install-token' } });

      const result = await getInstallationToken('42');

      expect(result).toBe('new-install-token');
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.github.com/app/installations/42/access_tokens',
        {},
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer mock-jwt' }),
        })
      );
      expect(redis.set).toHaveBeenCalledWith('gh-app:token:42', 'new-install-token', { ex: 55 * 60 });
    });

    test('returns null on API error', async () => {
      process.env.GITHUB_APP_ID = '12345';
      process.env.GITHUB_APP_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
      jwt.sign.mockReturnValue('mock-jwt');
      redis.get.mockResolvedValue(null);
      axios.post.mockRejectedValue(new Error('Failed'));

      const result = await getInstallationToken('42');
      expect(result).toBeNull();
    });

    test('returns null when no JWT', async () => {
      redis.get.mockResolvedValue(null);
      const result = await getInstallationToken('42');
      expect(result).toBeNull();
    });
  });

  describe('getTokenForRepo', () => {
    test('returns token when app is installed', async () => {
      process.env.GITHUB_APP_ID = '12345';
      process.env.GITHUB_APP_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----';
      jwt.sign.mockReturnValue('mock-jwt');
      // First call: getInstallationId checks cache
      redis.get.mockResolvedValueOnce('42');
      // Second call: getInstallationToken checks cache
      redis.get.mockResolvedValueOnce('install-token');

      const result = await getTokenForRepo('owner', 'repo');
      expect(result).toBe('install-token');
    });

    test('returns null when app is not installed', async () => {
      redis.get.mockResolvedValue(null);
      // No JWT → getInstallationId returns null
      const result = await getTokenForRepo('owner', 'repo');
      expect(result).toBeNull();
    });
  });
});
