jest.mock('axios');
jest.mock('../lib/github-token', () => ({
  resolveGitHubToken: jest.fn(() => Promise.resolve({ token: null, source: 'none' })),
}));
jest.mock('../lib/keys', () => ({
  generateApiKey: jest.fn(() => 'rm_test1234567890abcdef12345678'),
  storeApiKey: jest.fn(() => Promise.resolve('fakehash')),
  keyExistsForRepo: jest.fn(() => Promise.resolve(false)),
  storeConfirmToken: jest.fn(() => Promise.resolve()),
}));
jest.mock('../lib/email', () => ({
  isEmailConfigured: jest.fn(() => false),
  sendConfirmationEmail: jest.fn(() => Promise.resolve({ sent: true })),
}));

const axios = require('axios');
const { generateApiKey, storeApiKey, keyExistsForRepo, storeConfirmToken } = require('../lib/keys');
const { isEmailConfigured, sendConfirmationEmail } = require('../lib/email');
const registerHandler = require('../api/register');

const createMockReq = (body, method = 'POST') => ({
  url: '/api/register',
  method,
  body,
  headers: { host: 'localhost:5002' },
});

const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      res.headers[name] = value;
      return res;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
  };
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  keyExistsForRepo.mockResolvedValue(false);
  axios.get.mockResolvedValue({ data: { full_name: 'owner/repo' } });
});

describe('api/register', () => {
  test('returns 405 for non-POST requests', async () => {
    const req = createMockReq({}, 'GET');
    const res = createMockRes();

    await registerHandler(req, res);

    expect(res.statusCode).toBe(405);
  });

  test('returns 400 for missing fields', async () => {
    const req = createMockReq({ owner: 'facebook' });
    const res = createMockRes();

    await registerHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Missing required fields');
  });

  test('returns 400 for invalid email', async () => {
    const req = createMockReq({ owner: 'facebook', repo: 'react', email: 'invalid' });
    const res = createMockRes();

    await registerHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Invalid email');
  });

  test('returns 409 when key already exists for repo', async () => {
    keyExistsForRepo.mockResolvedValue(true);

    const req = createMockReq({ owner: 'facebook', repo: 'react', email: 'test@example.com' });
    const res = createMockRes();

    await registerHandler(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toContain('already exists');
  });

  test('returns 404 when repo does not exist on GitHub', async () => {
    axios.get.mockRejectedValue({ response: { status: 404 } });

    const req = createMockReq({ owner: 'nonexistent', repo: 'repo', email: 'test@example.com' });
    const res = createMockRes();

    await registerHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('not found');
  });

  test('successfully registers and returns key', async () => {
    const req = createMockReq({ owner: 'facebook', repo: 'react', email: 'test@example.com' });
    const res = createMockRes();

    await registerHandler(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.key).toBe('rm_test1234567890abcdef12345678');
    expect(res.body.owner).toBe('facebook');
    expect(res.body.repo).toBe('react');
    expect(res.body.tier).toBe('free');
  });

  test('stores the key after successful registration', async () => {
    const req = createMockReq({ owner: 'facebook', repo: 'react', email: 'test@example.com' });
    const res = createMockRes();

    await registerHandler(req, res);

    expect(storeApiKey).toHaveBeenCalledWith(
      'rm_test1234567890abcdef12345678',
      { owner: 'facebook', repo: 'react', email: 'test@example.com' },
      { pending: false }
    );
  });

  test('handles string body (Vercel format)', async () => {
    const req = createMockReq(JSON.stringify({ owner: 'facebook', repo: 'react', email: 'test@example.com' }));
    const res = createMockRes();

    await registerHandler(req, res);

    expect(res.statusCode).toBe(201);
  });

  test('returns 400 for invalid JSON string body', async () => {
    const req = createMockReq('not json');
    const res = createMockRes();

    await registerHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('Invalid JSON');
  });

  test('returns 500 when GitHub API fails with non-404 error', async () => {
    axios.get.mockRejectedValue({ response: { status: 500 } });

    const req = createMockReq({ owner: 'facebook', repo: 'react', email: 'test@example.com' });
    const res = createMockRes();

    await registerHandler(req, res);

    expect(res.statusCode).toBe(500);
  });

  test('includes message about saving the key when email not configured', async () => {
    const req = createMockReq({ owner: 'facebook', repo: 'react', email: 'test@example.com' });
    const res = createMockRes();

    await registerHandler(req, res);

    expect(res.body.message).toContain('.roadmapper');
    expect(res.body.pendingConfirmation).toBeUndefined();
  });

  describe('with email confirmation', () => {
    beforeEach(() => {
      isEmailConfigured.mockReturnValue(true);
      sendConfirmationEmail.mockResolvedValue({ sent: true });
    });

    test('returns pendingConfirmation when email configured', async () => {
      const req = createMockReq({ owner: 'facebook', repo: 'react', email: 'test@example.com' });
      const res = createMockRes();

      await registerHandler(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.body.pendingConfirmation).toBe(true);
      expect(res.body.key).toBe('rm_test1234567890abcdef12345678');
    });

    test('stores key as pending', async () => {
      const req = createMockReq({ owner: 'facebook', repo: 'react', email: 'test@example.com' });
      const res = createMockRes();

      await registerHandler(req, res);

      expect(storeApiKey).toHaveBeenCalledWith(
        'rm_test1234567890abcdef12345678',
        { owner: 'facebook', repo: 'react', email: 'test@example.com' },
        { pending: true }
      );
    });

    test('generates and stores confirmation token', async () => {
      const req = createMockReq({ owner: 'facebook', repo: 'react', email: 'test@example.com' });
      const res = createMockRes();

      await registerHandler(req, res);

      expect(storeConfirmToken).toHaveBeenCalledWith(expect.any(String), 'fakehash', 'rm_test1234567890abcdef12345678');
    });

    test('sends confirmation email', async () => {
      const req = createMockReq({ owner: 'facebook', repo: 'react', email: 'test@example.com' });
      const res = createMockRes();

      await registerHandler(req, res);

      expect(sendConfirmationEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('/api/confirm?token='),
        'facebook',
        'react'
      );
    });

    test('builds localhost URL for local development', async () => {
      const req = createMockReq({ owner: 'facebook', repo: 'react', email: 'test@example.com' });
      const res = createMockRes();

      await registerHandler(req, res);

      expect(sendConfirmationEmail).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('http://localhost:5002/api/confirm'),
        expect.any(String),
        expect.any(String)
      );
    });

    test('returns 500 when email sending fails', async () => {
      sendConfirmationEmail.mockRejectedValue(new Error('Resend API error'));

      const req = createMockReq({ owner: 'facebook', repo: 'react', email: 'test@example.com' });
      const res = createMockRes();

      await registerHandler(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toContain('confirmation email');
    });

    test('includes confirmation message', async () => {
      const req = createMockReq({ owner: 'facebook', repo: 'react', email: 'test@example.com' });
      const res = createMockRes();

      await registerHandler(req, res);

      expect(res.body.message).toContain('Check your email');
    });
  });

  describe('without email confirmation', () => {
    beforeEach(() => {
      isEmailConfigured.mockReturnValue(false);
    });

    test('does not send email', async () => {
      const req = createMockReq({ owner: 'facebook', repo: 'react', email: 'test@example.com' });
      const res = createMockRes();

      await registerHandler(req, res);

      expect(sendConfirmationEmail).not.toHaveBeenCalled();
      expect(storeConfirmToken).not.toHaveBeenCalled();
    });

    test('stores key with pending: false', async () => {
      const req = createMockReq({ owner: 'facebook', repo: 'react', email: 'test@example.com' });
      const res = createMockRes();

      await registerHandler(req, res);

      expect(storeApiKey).toHaveBeenCalledWith(
        'rm_test1234567890abcdef12345678',
        { owner: 'facebook', repo: 'react', email: 'test@example.com' },
        { pending: false }
      );
    });
  });
});
