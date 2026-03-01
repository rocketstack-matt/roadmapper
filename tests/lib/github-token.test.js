jest.mock('../../lib/github-app', () => ({
  isGitHubAppConfigured: jest.fn(() => false),
  getTokenForRepo: jest.fn(() => Promise.resolve(null)),
}));

const { isGitHubAppConfigured, getTokenForRepo } = require('../../lib/github-app');
const { resolveGitHubToken } = require('../../lib/github-token');

const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv };
  delete process.env.GITHUB_TOKEN;
});

afterAll(() => {
  process.env = originalEnv;
});

describe('lib/github-token', () => {
  describe('resolveGitHubToken', () => {
    test('returns app token when GitHub App is configured and installed', async () => {
      isGitHubAppConfigured.mockReturnValue(true);
      getTokenForRepo.mockResolvedValue('app-install-token');

      const result = await resolveGitHubToken('owner', 'repo');

      expect(result).toEqual({ token: 'app-install-token', source: 'app' });
    });

    test('falls back to PAT when GitHub App is configured but not installed', async () => {
      isGitHubAppConfigured.mockReturnValue(true);
      getTokenForRepo.mockResolvedValue(null);
      process.env.GITHUB_TOKEN = 'my-pat';

      const result = await resolveGitHubToken('owner', 'repo');

      expect(result).toEqual({ token: 'my-pat', source: 'pat' });
    });

    test('returns PAT when GitHub App is not configured', async () => {
      isGitHubAppConfigured.mockReturnValue(false);
      process.env.GITHUB_TOKEN = 'my-pat';

      const result = await resolveGitHubToken('owner', 'repo');

      expect(result).toEqual({ token: 'my-pat', source: 'pat' });
      expect(getTokenForRepo).not.toHaveBeenCalled();
    });

    test('returns none when nothing is configured', async () => {
      isGitHubAppConfigured.mockReturnValue(false);

      const result = await resolveGitHubToken('owner', 'repo');

      expect(result).toEqual({ token: null, source: 'none' });
    });

    test('returns none when GitHub App fails and no PAT', async () => {
      isGitHubAppConfigured.mockReturnValue(true);
      getTokenForRepo.mockResolvedValue(null);

      const result = await resolveGitHubToken('owner', 'repo');

      expect(result).toEqual({ token: null, source: 'none' });
    });
  });
});
