describe('lib/email', () => {
  const originalEnv = process.env.RESEND_API_KEY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.RESEND_API_KEY = originalEnv;
    } else {
      delete process.env.RESEND_API_KEY;
    }
    jest.resetModules();
  });

  describe('isEmailConfigured', () => {
    test('returns false when RESEND_API_KEY is not set', () => {
      delete process.env.RESEND_API_KEY;
      const { isEmailConfigured } = require('../../lib/email');
      expect(isEmailConfigured()).toBe(false);
    });

    test('returns true when RESEND_API_KEY is set', () => {
      process.env.RESEND_API_KEY = 'test_key';
      const { isEmailConfigured } = require('../../lib/email');
      expect(isEmailConfigured()).toBe(true);
    });
  });

  describe('sendConfirmationEmail', () => {
    test('returns skipped when not configured', async () => {
      delete process.env.RESEND_API_KEY;
      const { sendConfirmationEmail } = require('../../lib/email');
      const result = await sendConfirmationEmail('test@example.com', 'http://example.com/confirm', 'owner', 'repo');
      expect(result).toEqual({ skipped: true });
    });
  });
});
