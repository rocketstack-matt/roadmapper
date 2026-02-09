jest.mock('../lib/keys', () => ({
  confirmRegistration: jest.fn(),
}));

const { confirmRegistration } = require('../lib/keys');
const confirmHandler = require('../api/confirm');

const createMockReq = (url, method = 'GET') => ({
  url,
  method,
  headers: { host: 'localhost:5002' },
});

const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    redirectUrl: null,
    redirectStatus: null,
    setHeader(name, value) { res.headers[name] = value; return res; },
    status(code) { res.statusCode = code; return res; },
    send(body) { res.body = body; return res; },
    json(data) { res.body = data; return res; },
    redirect(status, url) { res.redirectStatus = status; res.redirectUrl = url; return res; },
  };
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('api/confirm', () => {
  test('returns 405 for non-GET requests', async () => {
    const req = createMockReq('/api/confirm?token=abc', 'POST');
    const res = createMockRes();
    await confirmHandler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: 'Method not allowed' });
  });

  test('redirects with error when no token provided', async () => {
    const req = createMockReq('/api/confirm');
    const res = createMockRes();
    await confirmHandler(req, res);
    expect(res.redirectStatus).toBe(302);
    expect(res.redirectUrl).toContain('confirm_error=');
    expect(res.redirectUrl).toContain(encodeURIComponent('No confirmation token provided'));
  });

  test('redirects with error for invalid token', async () => {
    confirmRegistration.mockResolvedValue({ success: false, reason: 'Invalid or expired confirmation token' });
    const req = createMockReq('/api/confirm?token=badtoken');
    const res = createMockRes();
    await confirmHandler(req, res);
    expect(res.redirectStatus).toBe(302);
    expect(res.redirectUrl).toContain('confirm_error=');
    expect(res.redirectUrl).toContain(encodeURIComponent('Invalid or expired confirmation token'));
  });

  test('redirects with confirmation data for valid token', async () => {
    confirmRegistration.mockResolvedValue({ success: true, owner: 'facebook', repo: 'react', key: 'rm_abc123' });
    const req = createMockReq('/api/confirm?token=validtoken');
    const res = createMockRes();
    await confirmHandler(req, res);
    expect(res.redirectStatus).toBe(302);
    expect(res.redirectUrl).toContain('confirmed=true');
    expect(res.redirectUrl).toContain('owner=facebook');
    expect(res.redirectUrl).toContain('repo=react');
    expect(res.redirectUrl).toContain('key=rm_abc123');
  });

  test('redirects with error reason when confirmation fails', async () => {
    confirmRegistration.mockResolvedValue({ success: false, reason: 'Registration data not found (may have expired)' });
    const req = createMockReq('/api/confirm?token=expired');
    const res = createMockRes();
    await confirmHandler(req, res);
    expect(res.redirectStatus).toBe(302);
    expect(res.redirectUrl).toContain(encodeURIComponent('Registration data not found'));
  });

  test('uses 302 redirect status', async () => {
    confirmRegistration.mockResolvedValue({ success: true, owner: 'owner', repo: 'repo', key: 'rm_key' });
    const req = createMockReq('/api/confirm?token=valid');
    const res = createMockRes();
    await confirmHandler(req, res);
    expect(res.redirectStatus).toBe(302);
  });
});
