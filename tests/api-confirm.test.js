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
    setHeader(name, value) { res.headers[name] = value; return res; },
    status(code) { res.statusCode = code; return res; },
    send(body) { res.body = body; return res; },
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
  });

  test('returns 400 when no token provided', async () => {
    const req = createMockReq('/api/confirm');
    const res = createMockRes();
    await confirmHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('Missing Token');
  });

  test('returns 400 for invalid token', async () => {
    confirmRegistration.mockResolvedValue({ success: false, reason: 'Invalid or expired confirmation token' });
    const req = createMockReq('/api/confirm?token=badtoken');
    const res = createMockRes();
    await confirmHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('Confirmation Failed');
  });

  test('returns 200 with success page for valid token', async () => {
    confirmRegistration.mockResolvedValue({ success: true, owner: 'facebook', repo: 'react' });
    const req = createMockReq('/api/confirm?token=validtoken');
    const res = createMockRes();
    await confirmHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Email Confirmed');
    expect(res.body).toContain('facebook/react');
  });

  test('returns HTML content type', async () => {
    confirmRegistration.mockResolvedValue({ success: true, owner: 'owner', repo: 'repo' });
    const req = createMockReq('/api/confirm?token=valid');
    const res = createMockRes();
    await confirmHandler(req, res);
    expect(res.headers['Content-Type']).toBe('text/html');
  });

  test('shows error reason in failure page', async () => {
    confirmRegistration.mockResolvedValue({ success: false, reason: 'Registration data not found (may have expired)' });
    const req = createMockReq('/api/confirm?token=expired');
    const res = createMockRes();
    await confirmHandler(req, res);
    expect(res.body).toContain('Registration data not found');
  });
});
