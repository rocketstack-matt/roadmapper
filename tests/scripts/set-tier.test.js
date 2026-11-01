// In-memory Redis so the script reads what the test seeds
const mockStore = new Map();
jest.mock('../../lib/redis', () => ({
  get: jest.fn(async (key) => (mockStore.has(key) ? mockStore.get(key) : null)),
  set: jest.fn(async (key, value) => { mockStore.set(key, value); return 'OK'; }),
  del: jest.fn(async (key) => (mockStore.delete(key) ? 1 : 0)),
  hgetall: jest.fn(async (key) => (mockStore.has(key) ? { ...mockStore.get(key) } : null)),
  hset: jest.fn(async (key, fields) => { mockStore.set(key, { ...(mockStore.get(key) || {}), ...fields }); return 1; }),
}));

jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('axios');

const axios = require('axios');
const { main } = require('../../scripts/set-tier');

const notFound = () => Object.assign(new Error('Not Found'), { response: { status: 404 } });

describe('scripts/set-tier.js', () => {
  let log;
  let error;

  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
    delete process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_PRIVATE_KEY;
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
    error = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    log.mockRestore();
    error.mockRestore();
  });

  describe('<owner> <repo> <tier> without App credentials', () => {
    it('updates the installation tier from a cached install mapping', async () => {
      mockStore.set('install:owner/repo', '42');
      mockStore.set('repo-key:owner/repo', 'hash1');
      mockStore.set('apikey:hash1', { owner: 'Owner', repo: 'Repo', tier: 'free' });

      const code = await main(['Owner', 'Repo', 'paid']);

      expect(code).toBe(0);
      expect(mockStore.get('installation:42').tier).toBe('paid');
      expect(mockStore.get('apikey:hash1').tier).toBe('paid');
      expect(axios.get).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith('Done. Owner/Repo is now on the "paid" tier.');
    });

    it('updates an installed repo with no API key', async () => {
      mockStore.set('install:owner/repo', '42');

      expect(await main(['owner', 'repo', 'paid'])).toBe(0);
      expect(mockStore.get('installation:42').tier).toBe('paid');
    });

    it('warns and exits non-zero when the install mapping is not cached', async () => {
      mockStore.set('repo-key:owner/repo', 'hash1');
      mockStore.set('apikey:hash1', { owner: 'owner', repo: 'repo', tier: 'free' });
      mockStore.set('repo:owner/repo', { tier: 'free', source: 'key' });

      const code = await main(['owner', 'repo', 'paid']);

      expect(code).toBe(1);
      expect(mockStore.get('apikey:hash1').tier).toBe('paid');
      expect(mockStore.has('repo:owner/repo')).toBe(false);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Could not tell whether owner/repo has the GitHub App installed'));
      expect(error).toHaveBeenCalledWith(expect.stringContaining('GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY are not set'));
      expect(log).not.toHaveBeenCalledWith(expect.stringContaining('Done.'));
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('trusts a cached not-installed marker', async () => {
      mockStore.set('install:owner/repo', 'none');
      mockStore.set('repo-key:owner/repo', 'hash1');
      mockStore.set('apikey:hash1', { owner: 'owner', repo: 'repo', tier: 'free' });

      expect(await main(['owner', 'repo', 'paid'])).toBe(0);
      expect(mockStore.get('apikey:hash1').tier).toBe('paid');
      expect(error).not.toHaveBeenCalled();
    });

    it('exits non-zero with no key and no cached mapping', async () => {
      expect(await main(['owner', 'repo', 'paid'])).toBe(1);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('No tier was set'));
    });

    it('fails when the repo has a not-installed marker and no key', async () => {
      mockStore.set('install:owner/repo', 'none');

      expect(await main(['owner', 'repo', 'paid'])).toBe(1);
      expect(error).toHaveBeenCalledWith('No API key or GitHub App installation found for owner/repo');
    });
  });

  describe('<owner> <repo> <tier> with App credentials', () => {
    beforeEach(() => {
      process.env.GITHUB_APP_ID = '123';
      // Never used to sign: every GitHub call is mocked
      process.env.GITHUB_APP_PRIVATE_KEY = require('crypto').generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      }).privateKey;
    });

    it('looks the installation up on GitHub when nothing is cached', async () => {
      axios.get.mockResolvedValue({ data: { id: 77, account: { login: 'owner' } } });

      expect(await main(['owner', 'repo', 'paid'])).toBe(0);
      expect(mockStore.get('installation:77').tier).toBe('paid');
    });

    it('treats a 404 as not installed', async () => {
      axios.get.mockRejectedValue(notFound());
      mockStore.set('repo-key:owner/repo', 'hash1');
      mockStore.set('apikey:hash1', { owner: 'owner', repo: 'repo', tier: 'free' });

      expect(await main(['owner', 'repo', 'paid'])).toBe(0);
      expect(mockStore.get('apikey:hash1').tier).toBe('paid');
    });

    it('warns and exits non-zero when the GitHub lookup fails', async () => {
      axios.get.mockRejectedValue(new Error('boom'));
      mockStore.set('repo-key:owner/repo', 'hash1');
      mockStore.set('apikey:hash1', { owner: 'owner', repo: 'repo', tier: 'free' });

      expect(await main(['owner', 'repo', 'paid'])).toBe(1);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('the GitHub lookup failed'));
    });
  });

  describe('--installation <id> <tier>', () => {
    it('sets the installation tier directly', async () => {
      expect(await main(['--installation', '42', 'paid'])).toBe(0);
      expect(mockStore.get('installation:42').tier).toBe('paid');
    });

    it('says when a Marketplace plan keeps the installation paid', async () => {
      process.env.GITHUB_MARKETPLACE_PLANS = '{"9001":"paid"}';
      mockStore.set('installation:42', { accountId: '77', tier: 'paid', repos: '[]' });
      mockStore.set('marketplace:77', { account: 'acme', planId: '9001', planName: 'Paid' });

      expect(await main(['--installation', '42', 'free'])).toBe(0);
      expect(mockStore.get('installation:42').tier).toBe('free');
      expect(log).toHaveBeenCalledWith('Installation 42 stays on "paid": its account has a GitHub Marketplace plan.');
      delete process.env.GITHUB_MARKETPLACE_PLANS;
    });

    it('rejects a non-numeric id', async () => {
      expect(await main(['--installation', 'abc', 'paid'])).toBe(1);
    });
  });

  it('rejects an unknown tier', async () => {
    expect(await main(['owner', 'repo', 'gold'])).toBe(1);
  });
});
