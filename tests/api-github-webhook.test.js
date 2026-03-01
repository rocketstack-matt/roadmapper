jest.mock('../lib/redis', () => ({
  get: jest.fn(() => Promise.resolve(null)),
  set: jest.fn(() => Promise.resolve('OK')),
  del: jest.fn(() => Promise.resolve(0)),
}));

const crypto = require('crypto');
const redis = require('../lib/redis');
const handler = require('../api/github/webhook');
const { verifySignature, storeInstallation, removeInstallation } = require('../api/github/webhook');
const { createMockRes } = require('./helpers');

const WEBHOOK_SECRET = 'test-webhook-secret';

const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv };
  process.env.GITHUB_APP_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

afterAll(() => {
  process.env = originalEnv;
});

const signPayload = (payload) => {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
};

const createWebhookReq = (event, body) => {
  const bodyStr = JSON.stringify(body);
  return {
    method: 'POST',
    headers: {
      'x-github-event': event,
      'x-hub-signature-256': signPayload(bodyStr),
      host: 'localhost:5002',
    },
    body,
    url: '/api/github/webhook',
  };
};

describe('api/github/webhook', () => {
  describe('verifySignature', () => {
    test('returns true for valid signature', () => {
      const payload = '{"test":true}';
      const sig = signPayload(payload);
      expect(verifySignature(payload, sig)).toBe(true);
    });

    test('returns false for invalid signature', () => {
      expect(verifySignature('{"test":true}', 'sha256=invalid')).toBe(false);
    });

    test('returns false when no secret configured', () => {
      delete process.env.GITHUB_APP_WEBHOOK_SECRET;
      expect(verifySignature('test', 'sha256=abc')).toBe(false);
    });

    test('returns false when no signature provided', () => {
      expect(verifySignature('test', undefined)).toBe(false);
    });
  });

  describe('storeInstallation', () => {
    test('stores installation ID for each repo', async () => {
      await storeInstallation(42, [
        { full_name: 'owner/repo1' },
        { full_name: 'owner/repo2' },
      ]);

      expect(redis.set).toHaveBeenCalledWith('gh-app:installation:owner/repo1', '42');
      expect(redis.set).toHaveBeenCalledWith('gh-app:installation:owner/repo2', '42');
    });
  });

  describe('removeInstallation', () => {
    test('removes installation and token data', async () => {
      await removeInstallation(42, [
        { full_name: 'owner/repo1' },
      ]);

      expect(redis.del).toHaveBeenCalledWith('gh-app:installation:owner/repo1');
      expect(redis.del).toHaveBeenCalledWith('gh-app:token:42');
    });
  });

  describe('handler', () => {
    test('rejects non-POST requests', async () => {
      const req = { method: 'GET', headers: {}, url: '/api/github/webhook' };
      const res = createMockRes();
      res.json = jest.fn().mockReturnValue(res);
      await handler(req, res);
      expect(res.statusCode).toBe(405);
    });

    test('rejects invalid signature', async () => {
      const req = {
        method: 'POST',
        headers: {
          'x-github-event': 'installation',
          'x-hub-signature-256': 'sha256=invalid',
          host: 'localhost:5002',
        },
        body: { action: 'created' },
        url: '/api/github/webhook',
      };
      const res = createMockRes();
      res.json = jest.fn().mockReturnValue(res);
      await handler(req, res);
      expect(res.statusCode).toBe(401);
    });

    test('handles installation.created event', async () => {
      const body = {
        action: 'created',
        installation: { id: 99 },
        repositories: [{ full_name: 'owner/repo' }],
      };
      const req = createWebhookReq('installation', body);
      const res = createMockRes();
      res.json = jest.fn().mockReturnValue(res);
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(redis.set).toHaveBeenCalledWith('gh-app:installation:owner/repo', '99');
    });

    test('handles installation.deleted event', async () => {
      const body = {
        action: 'deleted',
        installation: { id: 99 },
        repositories: [{ full_name: 'owner/repo' }],
      };
      const req = createWebhookReq('installation', body);
      const res = createMockRes();
      res.json = jest.fn().mockReturnValue(res);
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(redis.del).toHaveBeenCalledWith('gh-app:installation:owner/repo');
    });

    test('handles installation_repositories.added event', async () => {
      const body = {
        action: 'added',
        installation: { id: 77 },
        repositories_added: [{ full_name: 'org/new-repo' }],
      };
      const req = createWebhookReq('installation_repositories', body);
      const res = createMockRes();
      res.json = jest.fn().mockReturnValue(res);
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(redis.set).toHaveBeenCalledWith('gh-app:installation:org/new-repo', '77');
    });

    test('handles installation_repositories.removed event', async () => {
      const body = {
        action: 'removed',
        installation: { id: 77 },
        repositories_removed: [{ full_name: 'org/old-repo' }],
      };
      const req = createWebhookReq('installation_repositories', body);
      const res = createMockRes();
      res.json = jest.fn().mockReturnValue(res);
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(redis.del).toHaveBeenCalledWith('gh-app:installation:org/old-repo');
    });

    test('returns 200 for unhandled events', async () => {
      const body = {
        action: 'other',
        installation: { id: 1 },
      };
      const req = createWebhookReq('push', body);
      const res = createMockRes();
      res.json = jest.fn().mockReturnValue(res);
      await handler(req, res);

      expect(res.statusCode).toBe(200);
    });
  });
});
