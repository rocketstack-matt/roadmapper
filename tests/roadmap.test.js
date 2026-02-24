const axios = require('axios');
const {
  generateRoadmapSVG,
  fetchIssues,
  validateHexColor,
  normalizeHex,
  hexToRgba
} = require('../roadmap');

jest.mock('axios');

// Reusable mock issue data
const createMockIssue = (number, title, labelName, labelColor) => ({
  number,
  title,
  html_url: `https://github.com/owner/repo/issues/${number}`,
  labels: [{ name: labelName, color: labelColor }]
});

const mockIssues = [
  createMockIssue(1, 'Feature A', 'Roadmap: Now', '2da44e'),
  createMockIssue(2, 'Feature B', 'Roadmap: Next', 'fb8500'),
  createMockIssue(3, 'Feature C', 'Roadmap: Later', '8b949e'),
];

describe('validateHexColor', () => {
  test('returns null for null input', () => {
    expect(validateHexColor(null)).toBeNull();
  });

  test('returns null for undefined input', () => {
    expect(validateHexColor(undefined)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(validateHexColor('')).toBeNull();
  });

  test('validates 6-digit hex color', () => {
    expect(validateHexColor('ffffff')).toBe('ffffff');
  });

  test('validates 3-digit hex color', () => {
    expect(validateHexColor('fff')).toBe('fff');
  });

  test('validates hex with uppercase letters', () => {
    expect(validateHexColor('AABBCC')).toBe('AABBCC');
  });

  test('validates mixed case hex', () => {
    expect(validateHexColor('aAbBcC')).toBe('aAbBcC');
  });

  test('strips # prefix and validates', () => {
    expect(validateHexColor('#ff0000')).toBe('ff0000');
  });

  test('strips # prefix for 3-digit hex', () => {
    expect(validateHexColor('#f00')).toBe('f00');
  });

  test('returns null for invalid hex (wrong length)', () => {
    expect(validateHexColor('ff')).toBeNull();
  });

  test('returns null for invalid hex (4 digits)', () => {
    expect(validateHexColor('ffff')).toBeNull();
  });

  test('returns null for invalid hex (5 digits)', () => {
    expect(validateHexColor('fffff')).toBeNull();
  });

  test('returns null for invalid characters', () => {
    expect(validateHexColor('gggggg')).toBeNull();
  });

  test('returns null for hex with spaces', () => {
    expect(validateHexColor('ff ff ff')).toBeNull();
  });
});

describe('normalizeHex', () => {
  test('expands 3-digit hex to 6-digit', () => {
    expect(normalizeHex('fff')).toBe('ffffff');
  });

  test('expands mixed 3-digit hex', () => {
    expect(normalizeHex('abc')).toBe('aabbcc');
  });

  test('returns 6-digit hex unchanged', () => {
    expect(normalizeHex('aabbcc')).toBe('aabbcc');
  });

  test('expands 3-digit hex with numbers', () => {
    expect(normalizeHex('123')).toBe('112233');
  });
});

describe('hexToRgba', () => {
  test('converts white hex to rgba', () => {
    expect(hexToRgba('ffffff', 1)).toBe('rgba(255, 255, 255, 1)');
  });

  test('converts black hex to rgba', () => {
    expect(hexToRgba('000000', 1)).toBe('rgba(0, 0, 0, 1)');
  });

  test('converts red hex to rgba', () => {
    expect(hexToRgba('ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });

  test('handles 3-digit hex input', () => {
    expect(hexToRgba('f00', 0.8)).toBe('rgba(255, 0, 0, 0.8)');
  });

  test('handles alpha of 0', () => {
    expect(hexToRgba('ffffff', 0)).toBe('rgba(255, 255, 255, 0)');
  });

  test('converts arbitrary color correctly', () => {
    expect(hexToRgba('24292f', 0.7)).toBe('rgba(36, 41, 47, 0.7)');
  });
});

describe('generateRoadmapSVG', () => {
  test('returns a valid SVG string', () => {
    const svg = generateRoadmapSVG(mockIssues, 'ffffff', '24292f');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  test('includes three column headers', () => {
    const svg = generateRoadmapSVG(mockIssues, 'ffffff', '24292f');
    expect(svg).toContain('>Now<');
    expect(svg).toContain('>Next<');
    expect(svg).toContain('>Later<');
  });

  test('includes column subtitles', () => {
    const svg = generateRoadmapSVG(mockIssues, 'ffffff', '24292f');
    expect(svg).toContain("We're working on it right now");
    expect(svg).toContain('Coming up next');
    expect(svg).toContain('On the horizon');
  });

  test('includes issue titles', () => {
    const svg = generateRoadmapSVG(mockIssues, 'ffffff', '24292f');
    expect(svg).toContain('Feature A');
    expect(svg).toContain('Feature B');
    expect(svg).toContain('Feature C');
  });

  test('includes links to GitHub issues', () => {
    const svg = generateRoadmapSVG(mockIssues, 'ffffff', '24292f');
    expect(svg).toContain('href="https://github.com/owner/repo/issues/1"');
    expect(svg).toContain('href="https://github.com/owner/repo/issues/2"');
    expect(svg).toContain('href="https://github.com/owner/repo/issues/3"');
  });

  test('applies background color', () => {
    const svg = generateRoadmapSVG(mockIssues, 'ff0000', '24292f');
    expect(svg).toContain('background-color: #ff0000');
  });

  test('applies text color to headers', () => {
    const svg = generateRoadmapSVG(mockIssues, 'ffffff', '00ff00');
    expect(svg).toContain('fill: #00ff00');
  });

  test('falls back to default colors for invalid bgColor', () => {
    const svg = generateRoadmapSVG(mockIssues, 'invalid', '24292f');
    expect(svg).toContain('background-color: #ffffff');
  });

  test('falls back to default colors for invalid textColor', () => {
    const svg = generateRoadmapSVG(mockIssues, 'ffffff', 'invalid');
    expect(svg).toContain('fill: #24292f');
  });

  test('normalizes 3-digit hex colors', () => {
    const svg = generateRoadmapSVG(mockIssues, 'f00', '000');
    expect(svg).toContain('background-color: #ff0000');
    expect(svg).toContain('fill: #000000');
  });

  test('applies label colors as accent borders', () => {
    const svg = generateRoadmapSVG(mockIssues, 'ffffff', '24292f');
    expect(svg).toContain('fill: #2da44e');
    expect(svg).toContain('fill: #fb8500');
    expect(svg).toContain('fill: #8b949e');
  });

  test('uses default label color when no label color exists', () => {
    const issueNoColor = [{
      number: 1,
      title: 'No color issue',
      html_url: 'https://github.com/owner/repo/issues/1',
      labels: [{ name: 'Roadmap: Now' }]
    }];
    const svg = generateRoadmapSVG(issueNoColor, 'ffffff', '24292f');
    expect(svg).toContain('fill: #8b949e');
  });

  test('sorts issues by number', () => {
    const unsortedIssues = [
      createMockIssue(3, 'Third', 'Roadmap: Now', '2da44e'),
      createMockIssue(1, 'First', 'Roadmap: Now', '2da44e'),
      createMockIssue(2, 'Second', 'Roadmap: Now', '2da44e'),
    ];
    const svg = generateRoadmapSVG(unsortedIssues, 'ffffff', '24292f');
    const firstIdx = svg.indexOf('First');
    const secondIdx = svg.indexOf('Second');
    const thirdIdx = svg.indexOf('Third');
    expect(firstIdx).toBeLessThan(secondIdx);
    expect(secondIdx).toBeLessThan(thirdIdx);
  });

  test('handles empty issues array', () => {
    const svg = generateRoadmapSVG([], 'ffffff', '24292f');
    expect(svg).toContain('<svg');
    expect(svg).toContain('>Now<');
    expect(svg).toContain('>Next<');
    expect(svg).toContain('>Later<');
  });

  test('calculates SVG height based on max items per column', () => {
    const issues = [
      createMockIssue(1, 'Issue 1', 'Roadmap: Now', '2da44e'),
      createMockIssue(2, 'Issue 2', 'Roadmap: Now', '2da44e'),
      createMockIssue(3, 'Issue 3', 'Roadmap: Now', '2da44e'),
    ];
    const svg = generateRoadmapSVG(issues, 'ffffff', '24292f');
    // Height = 140 + (3 * 95) + 30 (footer) = 455
    expect(svg).toContain('viewBox="0 0 1140 455"');
  });

  test('excludes issues without roadmap labels', () => {
    const mixedIssues = [
      createMockIssue(1, 'Roadmap Issue', 'Roadmap: Now', '2da44e'),
      {
        number: 2,
        title: 'Bug Fix',
        html_url: 'https://github.com/owner/repo/issues/2',
        labels: [{ name: 'bug', color: 'd73a4a' }]
      },
    ];
    const svg = generateRoadmapSVG(mixedIssues, 'ffffff', '24292f');
    expect(svg).toContain('Roadmap Issue');
    expect(svg).not.toContain('Bug Fix');
  });

  test('includes hover shadow styles', () => {
    const svg = generateRoadmapSVG(mockIssues, 'ffffff', '24292f');
    expect(svg).toContain('.roadmap-card:hover');
    expect(svg).toContain('drop-shadow');
  });

  test('positions columns at correct x offsets', () => {
    const svg = generateRoadmapSVG(mockIssues, 'ffffff', '24292f');
    expect(svg).toContain('translate(0, 0)');
    expect(svg).toContain('translate(380, 0)');
    expect(svg).toContain('translate(760, 0)');
  });
});

describe('fetchIssues', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    axios.get.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('fetches issues from GitHub API', async () => {
    axios.get.mockResolvedValue({ data: mockIssues });

    const issues = await fetchIssues('owner', 'repo');

    expect(axios.get).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/issues?per_page=100',
      { headers: {} }
    );
    expect(issues).toEqual(mockIssues);
  });

  test('includes auth header when GITHUB_TOKEN is set', async () => {
    process.env.GITHUB_TOKEN = 'test-token-123';
    axios.get.mockResolvedValue({ data: mockIssues });

    await fetchIssues('owner', 'repo');

    expect(axios.get).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/issues?per_page=100',
      { headers: { Authorization: 'Bearer test-token-123' } }
    );
  });

  test('does not include auth header when GITHUB_TOKEN is not set', async () => {
    delete process.env.GITHUB_TOKEN;
    axios.get.mockResolvedValue({ data: mockIssues });

    await fetchIssues('owner', 'repo');

    expect(axios.get).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/issues?per_page=100',
      { headers: {} }
    );
  });

  test('throws error when API call fails', async () => {
    axios.get.mockRejectedValue(new Error('API Error'));

    await expect(fetchIssues('owner', 'repo')).rejects.toThrow('API Error');
  });

  test('constructs correct URL with owner and repo', async () => {
    axios.get.mockResolvedValue({ data: [] });

    await fetchIssues('facebook', 'react');

    expect(axios.get).toHaveBeenCalledWith(
      'https://api.github.com/repos/facebook/react/issues?per_page=100',
      expect.any(Object)
    );
  });
});
