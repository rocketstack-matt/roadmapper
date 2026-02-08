const {
  generateApiKey, hashApiKey, storeApiKey, lookupApiKey, keyExistsForRepo,
  storeConfirmToken, lookupConfirmToken, confirmRegistration, REGISTRATION_TTL,
} = require('../../lib/keys');

// Mock redis
jest.mock('../../lib/redis', () => ({
  hset: jest.fn(() => Promise.resolve(0)),
  hgetall: jest.fn(() => Promise.resolve(null)),
  set: jest.fn(() => Promise.resolve('OK')),
  get: jest.fn(() => Promise.resolve(null)),
  expire: jest.fn(() => Promise.resolve(0)),
  persist: jest.fn(() => Promise.resolve(0)),
  del: jest.fn(() => Promise.resolve(0)),
}));

const redis = require('../../lib/redis');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('lib/keys', () => {
  describe('generateApiKey', () => {
    test('generates key with rm_ prefix', () => {
      const key = generateApiKey();
      expect(key.startsWith('rm_')).toBe(true);
    });

    test('generates key with correct length (rm_ + 32 hex chars)', () => {
      const key = generateApiKey();
      expect(key.length).toBe(35);
    });

    test('generates unique keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });

    test('key body is valid hex', () => {
      const key = generateApiKey();
      const body = key.slice(3);
      expect(/^[0-9a-f]{32}$/.test(body)).toBe(true);
    });
  });

  describe('hashApiKey', () => {
    test('returns a SHA-256 hash string', () => {
      const hash = hashApiKey('rm_test1234567890abcdef12345678');
      expect(hash.length).toBe(64);
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });

    test('produces deterministic output', () => {
      const key = 'rm_test1234567890abcdef12345678';
      expect(hashApiKey(key)).toBe(hashApiKey(key));
    });

    test('different keys produce different hashes', () => {
      const hash1 = hashApiKey('rm_aaaa1234567890abcdef12345678');
      const hash2 = hashApiKey('rm_bbbb1234567890abcdef12345678');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('storeApiKey', () => {
    test('stores key metadata in Redis', async () => {
      const key = 'rm_test1234567890abcdef12345678';
      await storeApiKey(key, { owner: 'facebook', repo: 'react', email: 'test@example.com' });

      expect(redis.hset).toHaveBeenCalledWith(
        expect.stringContaining('apikey:'),
        expect.objectContaining({
          owner: 'facebook',
          repo: 'react',
          tier: 'free',
          email: 'test@example.com',
        })
      );
    });

    test('stores reverse lookup for repo', async () => {
      const key = 'rm_test1234567890abcdef12345678';
      await storeApiKey(key, { owner: 'facebook', repo: 'react', email: 'test@example.com' });

      expect(redis.set).toHaveBeenCalledWith('repo-key:facebook/react', expect.any(String));
    });

    test('returns the hash', async () => {
      const key = 'rm_test1234567890abcdef12345678';
      const hash = await storeApiKey(key, { owner: 'facebook', repo: 'react', email: 'test@example.com' });
      expect(hash).toBe(hashApiKey(key));
    });
  });

  describe('lookupApiKey', () => {
    test('returns key data when found', async () => {
      redis.hgetall.mockResolvedValue({ owner: 'facebook', repo: 'react', tier: 'free' });

      const result = await lookupApiKey('rm_test1234567890abcdef12345678');
      expect(result).toEqual({ owner: 'facebook', repo: 'react', tier: 'free' });
    });

    test('returns null when key not found', async () => {
      redis.hgetall.mockResolvedValue(null);

      const result = await lookupApiKey('rm_nonexistent00000000000000000');
      expect(result).toBeNull();
    });
  });

  describe('keyExistsForRepo', () => {
    test('returns true when key exists for repo', async () => {
      redis.get.mockResolvedValue('somehash');

      const exists = await keyExistsForRepo('facebook', 'react');
      expect(exists).toBe(true);
    });

    test('returns false when no key for repo', async () => {
      redis.get.mockResolvedValue(null);

      const exists = await keyExistsForRepo('facebook', 'react');
      expect(exists).toBe(false);
    });
  });

  describe('storeApiKey with pending option', () => {
    test('sets emailConfirmed to false when pending', async () => {
      const key = 'rm_test1234567890abcdef12345678';
      await storeApiKey(key, { owner: 'fb', repo: 'react', email: 'a@b.com' }, { pending: true });

      expect(redis.hset).toHaveBeenCalledWith(
        expect.stringContaining('apikey:'),
        expect.objectContaining({ emailConfirmed: 'false' })
      );
    });

    test('sets TTL on both keys when pending', async () => {
      const key = 'rm_test1234567890abcdef12345678';
      const hash = hashApiKey(key);
      await storeApiKey(key, { owner: 'fb', repo: 'react', email: 'a@b.com' }, { pending: true });

      expect(redis.expire).toHaveBeenCalledWith(`apikey:${hash}`, REGISTRATION_TTL);
      expect(redis.expire).toHaveBeenCalledWith('repo-key:fb/react', REGISTRATION_TTL);
    });

    test('does not set emailConfirmed or TTL without pending', async () => {
      const key = 'rm_test1234567890abcdef12345678';
      await storeApiKey(key, { owner: 'fb', repo: 'react', email: 'a@b.com' });

      const fields = redis.hset.mock.calls[0][1];
      expect(fields.emailConfirmed).toBeUndefined();
      expect(redis.expire).not.toHaveBeenCalled();
    });
  });

  describe('storeConfirmToken', () => {
    test('stores token with TTL', async () => {
      await storeConfirmToken('mytoken', 'myhash');

      expect(redis.set).toHaveBeenCalledWith('confirm:mytoken', 'myhash', { ex: REGISTRATION_TTL });
    });
  });

  describe('lookupConfirmToken', () => {
    test('returns hash when token exists', async () => {
      redis.get.mockResolvedValue('thehash');

      const result = await lookupConfirmToken('mytoken');
      expect(result).toBe('thehash');
      expect(redis.get).toHaveBeenCalledWith('confirm:mytoken');
    });

    test('returns null when token not found', async () => {
      redis.get.mockResolvedValue(null);

      const result = await lookupConfirmToken('badtoken');
      expect(result).toBeNull();
    });
  });

  describe('confirmRegistration', () => {
    test('confirms valid token and removes TTLs', async () => {
      redis.get.mockResolvedValue('keyhash123');
      redis.hgetall.mockResolvedValue({ owner: 'fb', repo: 'react', emailConfirmed: 'false' });

      const result = await confirmRegistration('validtoken');

      expect(result).toEqual({ success: true, owner: 'fb', repo: 'react' });
      expect(redis.hset).toHaveBeenCalledWith('apikey:keyhash123', { emailConfirmed: 'true' });
      expect(redis.persist).toHaveBeenCalledWith('apikey:keyhash123');
      expect(redis.persist).toHaveBeenCalledWith('repo-key:fb/react');
      expect(redis.del).toHaveBeenCalledWith('confirm:validtoken');
    });

    test('returns failure for invalid token', async () => {
      redis.get.mockResolvedValue(null);

      const result = await confirmRegistration('badtoken');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Invalid or expired');
    });

    test('returns failure when registration data expired', async () => {
      redis.get.mockResolvedValue('keyhash123');
      redis.hgetall.mockResolvedValue(null);

      const result = await confirmRegistration('orphantoken');

      expect(result.success).toBe(false);
      expect(result.reason).toContain('not found');
    });
  });

  describe('REGISTRATION_TTL', () => {
    test('is 24 hours in seconds', () => {
      expect(REGISTRATION_TTL).toBe(86400);
    });
  });
});
