const axios = require('axios');
const {
  generateRoadmapSVG,
  fetchIssues,
  validateHexColor,
  normalizeHex,
  hexToRgba,
  groupIssues,
  buildGlobalLayout,
  calculateColumnHeight,
  COLUMN_HEADER_HEIGHT,
  CARD_SLOT_HEIGHT,
  GROUP_HEADER_HEIGHT,
  INTER_GROUP_GAP,
  GROUP_LABEL_PREFIX,
  UNGROUPED_LABEL
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

describe('groupIssues', () => {
  test('returns all issues as ungrouped when no group labels exist', () => {
    const issues = [
      createMockIssue(1, 'Feature A', 'Roadmap: Now', '2da44e'),
      createMockIssue(2, 'Feature B', 'Roadmap: Now', '2da44e'),
    ];
    const result = groupIssues(issues);
    expect(result.groups).toHaveLength(0);
    expect(result.ungrouped).toHaveLength(2);
  });

  test('groups issues by Roadmap Group label', () => {
    const issues = [
      { number: 1, title: 'A', html_url: 'u/1', labels: [{ name: 'Roadmap: Now', color: '2da44e' }, { name: 'Roadmap Group: Frontend', color: 'ff0000' }] },
      { number: 2, title: 'B', html_url: 'u/2', labels: [{ name: 'Roadmap: Now', color: '2da44e' }, { name: 'Roadmap Group: Frontend', color: 'ff0000' }] },
      { number: 3, title: 'C', html_url: 'u/3', labels: [{ name: 'Roadmap: Now', color: '2da44e' }, { name: 'Roadmap Group: Backend', color: '00ff00' }] },
    ];
    const result = groupIssues(issues);
    expect(result.groups).toHaveLength(2);
    expect(result.ungrouped).toHaveLength(0);
  });

  test('sorts groups alphabetically by name', () => {
    const issues = [
      { number: 1, title: 'A', html_url: 'u/1', labels: [{ name: 'Roadmap Group: Zebra', color: 'aaa' }] },
      { number: 2, title: 'B', html_url: 'u/2', labels: [{ name: 'Roadmap Group: Alpha', color: 'bbb' }] },
    ];
    const result = groupIssues(issues);
    expect(result.groups[0].name).toBe('Alpha');
    expect(result.groups[1].name).toBe('Zebra');
  });

  test('strips Roadmap Group: prefix from group name', () => {
    const issues = [
      { number: 1, title: 'A', html_url: 'u/1', labels: [{ name: 'Roadmap Group: My Team', color: 'aaa' }] },
    ];
    const result = groupIssues(issues);
    expect(result.groups[0].name).toBe('My Team');
  });

  test('extracts group label color', () => {
    const issues = [
      { number: 1, title: 'A', html_url: 'u/1', labels: [{ name: 'Roadmap Group: Frontend', color: 'ff5500' }] },
    ];
    const result = groupIssues(issues);
    expect(result.groups[0].color).toBe('ff5500');
  });

  test('separates grouped and ungrouped issues', () => {
    const issues = [
      { number: 1, title: 'Grouped', html_url: 'u/1', labels: [{ name: 'Roadmap Group: API', color: 'aaa' }] },
      { number: 2, title: 'Ungrouped', html_url: 'u/2', labels: [{ name: 'Roadmap: Now', color: 'bbb' }] },
    ];
    const result = groupIssues(issues);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].issues).toHaveLength(1);
    expect(result.groups[0].issues[0].title).toBe('Grouped');
    expect(result.ungrouped).toHaveLength(1);
    expect(result.ungrouped[0].title).toBe('Ungrouped');
  });

  test('uses first matching group label when issue has multiple', () => {
    const issues = [
      { number: 1, title: 'A', html_url: 'u/1', labels: [
        { name: 'Roadmap Group: First', color: 'aaa' },
        { name: 'Roadmap Group: Second', color: 'bbb' }
      ]},
    ];
    const result = groupIssues(issues);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].name).toBe('First');
  });

  test('handles empty issues array', () => {
    const result = groupIssues([]);
    expect(result.groups).toHaveLength(0);
    expect(result.ungrouped).toHaveLength(0);
  });
});

describe('calculateColumnHeight', () => {
  test('returns base height for empty column', () => {
    const result = calculateColumnHeight({ groups: [], ungrouped: [] });
    expect(result).toBe(COLUMN_HEADER_HEIGHT);
  });

  test('matches old formula when no groups exist', () => {
    const ungrouped = [{}, {}, {}]; // 3 items
    const result = calculateColumnHeight({ groups: [], ungrouped });
    // Old formula: 130 + 3*95 = 415
    expect(result).toBe(COLUMN_HEADER_HEIGHT + 3 * CARD_SLOT_HEIGHT);
  });

  test('accounts for group headers', () => {
    const groupedData = {
      groups: [
        { name: 'A', color: 'aaa', issues: [{}] },
        { name: 'B', color: 'bbb', issues: [{}] },
      ],
      ungrouped: []
    };
    const result = calculateColumnHeight(groupedData);
    // 130 + 2*35 (headers) + 1*10 (inter-group gap) + 2*95 (cards)
    expect(result).toBe(130 + 70 + 10 + 190);
  });

  test('accounts for gap before ungrouped when groups exist', () => {
    const groupedData = {
      groups: [{ name: 'A', color: 'aaa', issues: [{}] }],
      ungrouped: [{}]
    };
    const result = calculateColumnHeight(groupedData);
    // 130 + 1*35 (header) + 0 (no inter-group gap for single group) + 1*10 (gap before ungrouped) + 2*95 (cards)
    expect(result).toBe(130 + 35 + 10 + 190);
  });
});

describe('buildGlobalLayout', () => {
  const emptyGrouped = { groups: [], ungrouped: [] };

  test('returns flat layout when no groups exist', () => {
    const columns = {
      now: { groups: [], ungrouped: [{}, {}] },
      next: { groups: [], ungrouped: [{}] },
      later: { groups: [], ungrouped: [] }
    };
    const layout = buildGlobalLayout(columns);
    expect(layout.hasGroups).toBe(false);
    expect(layout.bands).toHaveLength(0);
    expect(layout.ungroupedBand).toBeNull();
    expect(layout.totalHeight).toBe(COLUMN_HEADER_HEIGHT + 2 * CARD_SLOT_HEIGHT);
  });

  test('creates bands for groups spanning all columns', () => {
    const columns = {
      now: { groups: [{ name: 'API', color: 'aaa', issues: [{}, {}] }], ungrouped: [] },
      next: { groups: [{ name: 'API', color: 'aaa', issues: [{}] }], ungrouped: [] },
      later: { groups: [], ungrouped: [] }
    };
    const layout = buildGlobalLayout(columns);
    expect(layout.hasGroups).toBe(true);
    expect(layout.bands).toHaveLength(1);
    expect(layout.bands[0].name).toBe('API');
    expect(layout.bands[0].maxCards).toBe(2); // max across columns
  });

  test('sorts bands alphabetically', () => {
    const columns = {
      now: { groups: [{ name: 'Zebra', color: 'aaa', issues: [{}] }], ungrouped: [] },
      next: { groups: [{ name: 'Alpha', color: 'bbb', issues: [{}] }], ungrouped: [] },
      later: emptyGrouped
    };
    const layout = buildGlobalLayout(columns);
    expect(layout.bands[0].name).toBe('Alpha');
    expect(layout.bands[1].name).toBe('Zebra');
  });

  test('calculates correct yStart for each band', () => {
    const columns = {
      now: { groups: [
        { name: 'A', color: 'aaa', issues: [{}] },
        { name: 'B', color: 'bbb', issues: [{}, {}] }
      ], ungrouped: [] },
      next: emptyGrouped,
      later: emptyGrouped
    };
    const layout = buildGlobalLayout(columns);
    // Band A: yStart = 130
    expect(layout.bands[0].yStart).toBe(COLUMN_HEADER_HEIGHT);
    // Band B: yStart = 130 + 35 + 1*95 + 10 = 270
    expect(layout.bands[1].yStart).toBe(COLUMN_HEADER_HEIGHT + GROUP_HEADER_HEIGHT + CARD_SLOT_HEIGHT + INTER_GROUP_GAP);
  });

  test('creates ungrouped band when groups and ungrouped issues coexist', () => {
    const columns = {
      now: { groups: [{ name: 'API', color: 'aaa', issues: [{}] }], ungrouped: [{}] },
      next: emptyGrouped,
      later: { groups: [], ungrouped: [{}, {}] }
    };
    const layout = buildGlobalLayout(columns);
    expect(layout.ungroupedBand).not.toBeNull();
    expect(layout.ungroupedBand.name).toBe(UNGROUPED_LABEL);
    expect(layout.ungroupedBand.maxCards).toBe(2); // max ungrouped across columns
  });

  test('no ungrouped band when all issues are grouped', () => {
    const columns = {
      now: { groups: [{ name: 'API', color: 'aaa', issues: [{}] }], ungrouped: [] },
      next: emptyGrouped,
      later: emptyGrouped
    };
    const layout = buildGlobalLayout(columns);
    expect(layout.ungroupedBand).toBeNull();
  });

  test('calculates correct totalHeight with bands and ungrouped', () => {
    const columns = {
      now: { groups: [{ name: 'API', color: 'aaa', issues: [{}, {}] }], ungrouped: [{}] },
      next: { groups: [{ name: 'API', color: 'aaa', issues: [{}] }], ungrouped: [{}, {}, {}] },
      later: emptyGrouped
    };
    const layout = buildGlobalLayout(columns);
    // Band API: 35 + 2*95 = 225
    // Gap: 10
    // Ungrouped band: 35 + 3*95 = 320
    // Total: 130 + 225 + 10 + 320 = 685
    expect(layout.totalHeight).toBe(COLUMN_HEADER_HEIGHT + GROUP_HEADER_HEIGHT + 2 * CARD_SLOT_HEIGHT + INTER_GROUP_GAP + GROUP_HEADER_HEIGHT + 3 * CARD_SLOT_HEIGHT);
  });

  test('uses max card count across columns for band height', () => {
    const columns = {
      now: { groups: [{ name: 'X', color: 'aaa', issues: [{}] }], ungrouped: [] },
      next: { groups: [{ name: 'X', color: 'aaa', issues: [{}, {}, {}] }], ungrouped: [] },
      later: { groups: [{ name: 'X', color: 'aaa', issues: [{}, {}] }], ungrouped: [] }
    };
    const layout = buildGlobalLayout(columns);
    expect(layout.bands[0].maxCards).toBe(3);
    expect(layout.bands[0].bandHeight).toBe(GROUP_HEADER_HEIGHT + 3 * CARD_SLOT_HEIGHT);
  });

  test('handles group in only one column', () => {
    const columns = {
      now: { groups: [{ name: 'Solo', color: 'fff', issues: [{}] }], ungrouped: [] },
      next: emptyGrouped,
      later: emptyGrouped
    };
    const layout = buildGlobalLayout(columns);
    expect(layout.hasGroups).toBe(true);
    expect(layout.bands).toHaveLength(1);
    expect(layout.bands[0].name).toBe('Solo');
    expect(layout.bands[0].maxCards).toBe(1);
  });
});

describe('generateRoadmapSVG with groups', () => {
  test('renders full-width group container', () => {
    const issues = [
      { number: 1, title: 'Card 1', html_url: 'u/1', labels: [
        { name: 'Roadmap: Now', color: '2da44e' },
        { name: 'Roadmap Group: Frontend', color: 'ff0000' }
      ]},
    ];
    const svg = generateRoadmapSVG(issues, 'ffffff', '24292f');
    // Single full-width container with group name
    expect(svg).toContain('Frontend');
    expect(svg).toContain('width="1130"'); // full-width container
    expect(svg).toContain('drop-shadow'); // shadow-only container
  });

  test('renders cards within groups', () => {
    const issues = [
      { number: 1, title: 'Grouped Card', html_url: 'https://github.com/o/r/issues/1', labels: [
        { name: 'Roadmap: Now', color: '2da44e' },
        { name: 'Roadmap Group: API', color: 'aabbcc' }
      ]},
    ];
    const svg = generateRoadmapSVG(issues, 'ffffff', '24292f');
    expect(svg).toContain('Grouped Card');
    expect(svg).toContain('href="https://github.com/o/r/issues/1"');
  });

  test('renders ungrouped cards under Other header', () => {
    const issues = [
      { number: 1, title: 'Grouped', html_url: 'u/1', labels: [
        { name: 'Roadmap: Now', color: '2da44e' },
        { name: 'Roadmap Group: Team A', color: 'ff0000' }
      ]},
      { number: 2, title: 'Ungrouped', html_url: 'u/2', labels: [
        { name: 'Roadmap: Now', color: '2da44e' }
      ]},
    ];
    const svg = generateRoadmapSVG(issues, 'ffffff', '24292f');
    expect(svg).toContain('>Other<');
    const groupedIdx = svg.indexOf('Grouped');
    const ungroupedIdx = svg.indexOf('Ungrouped');
    expect(groupedIdx).toBeLessThan(ungroupedIdx);
  });

  test('backward compatible - no groups produces same structure as before', () => {
    const issues = [
      createMockIssue(1, 'Feature A', 'Roadmap: Now', '2da44e'),
      createMockIssue(2, 'Feature B', 'Roadmap: Next', 'fb8500'),
    ];
    const svg = generateRoadmapSVG(issues, 'ffffff', '24292f');
    // Should not contain any group header elements
    expect(svg).not.toContain('>Other<');
    expect(svg).not.toMatch(/opacity: 0\.8;.*Roadmap Group/);
    expect(svg).toContain('Feature A');
    expect(svg).toContain('Feature B');
  });

  test('adjusts SVG height for global band layout', () => {
    // Group in Now only, ungrouped in Later only
    const issues = [
      { number: 1, title: 'A', html_url: 'u/1', labels: [
        { name: 'Roadmap: Now', color: '2da44e' },
        { name: 'Roadmap Group: Group 1', color: 'aaa' }
      ]},
      { number: 2, title: 'B', html_url: 'u/2', labels: [
        { name: 'Roadmap: Later', color: '8b949e' }
      ]},
    ];
    const svg = generateRoadmapSVG(issues, 'ffffff', '24292f');
    // Global layout:
    // Band "Group 1": 130 + 35 + 1*95 = 260
    // Gap: 10
    // Ungrouped band: 270 + 35 + 1*95 = 400
    // footerY = 400 + 10 = 410, svgHeight = 440
    expect(svg).toContain('viewBox="0 0 1140 440"');
  });

  test('full-width container spans all columns even when group has cards in only one', () => {
    // Group only in Now column
    const issues = [
      { number: 1, title: 'Now Card', html_url: 'u/1', labels: [
        { name: 'Roadmap: Now', color: '2da44e' },
        { name: 'Roadmap Group: API', color: 'ff0000' }
      ]},
    ];
    const svg = generateRoadmapSVG(issues, 'ffffff', '24292f');
    // Single full-width container with group name
    const apiMatches = svg.match(/>API</g);
    expect(apiMatches).toHaveLength(1);
    expect(svg).toContain('width="1130"');
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

describe('fetchIssues with ETag caching', () => {
  const originalEnv = process.env;
  let mockGetCachedIssues;
  let mockCacheIssues;
  let mockIsCacheFresh;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.GITHUB_TOKEN;

    mockGetCachedIssues = jest.fn(() => Promise.resolve(null));
    mockCacheIssues = jest.fn(() => Promise.resolve());
    mockIsCacheFresh = jest.fn(() => false);

    jest.doMock('../lib/cache', () => ({
      getCachedIssues: mockGetCachedIssues,
      cacheIssues: mockCacheIssues,
      isCacheFresh: mockIsCacheFresh,
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function requireFresh() {
    const freshAxios = require('axios');
    const { fetchIssues: freshFetchIssues } = require('../roadmap');
    return { axios: freshAxios, fetchIssues: freshFetchIssues };
  }

  test('returns cached issues without API call when cache is fresh', async () => {
    const cachedData = { issues: mockIssues, etag: '"abc"', cachedAt: Date.now() };
    mockGetCachedIssues.mockResolvedValue(cachedData);
    mockIsCacheFresh.mockReturnValue(true);

    const { axios: freshAxios, fetchIssues: freshFetchIssues } = requireFresh();
    freshAxios.get = jest.fn();

    const result = await freshFetchIssues('owner', 'repo', 3600);

    expect(result).toEqual(mockIssues);
    expect(freshAxios.get).not.toHaveBeenCalled();
    expect(mockCacheIssues).not.toHaveBeenCalled();
  });

  test('sends If-None-Match header when stale cache has ETag', async () => {
    const cachedData = { issues: mockIssues, etag: '"etag-123"', cachedAt: 1000 };
    mockGetCachedIssues.mockResolvedValue(cachedData);
    mockIsCacheFresh.mockReturnValue(false);

    const { axios: freshAxios, fetchIssues: freshFetchIssues } = requireFresh();
    freshAxios.get = jest.fn().mockResolvedValue({
      status: 304,
      data: null,
      headers: {},
    });

    await freshFetchIssues('owner', 'repo', 3600);

    expect(freshAxios.get).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo/issues?per_page=100',
      expect.objectContaining({
        headers: expect.objectContaining({ 'If-None-Match': '"etag-123"' }),
      })
    );
  });

  test('refreshes cachedAt on 304 response and returns cached issues', async () => {
    const cachedData = { issues: mockIssues, etag: '"etag-123"', cachedAt: 1000 };
    mockGetCachedIssues.mockResolvedValue(cachedData);
    mockIsCacheFresh.mockReturnValue(false);

    const { axios: freshAxios, fetchIssues: freshFetchIssues } = requireFresh();
    freshAxios.get = jest.fn().mockResolvedValue({
      status: 304,
      data: null,
      headers: {},
    });

    const result = await freshFetchIssues('owner', 'repo', 3600);

    expect(result).toEqual(mockIssues);
    expect(mockCacheIssues).toHaveBeenCalledWith('owner', 'repo', mockIssues, 3600, '"etag-123"');
  });

  test('stores new data and ETag on 200 response with stale cache', async () => {
    const cachedData = { issues: [{ old: true }], etag: '"old-etag"', cachedAt: 1000 };
    mockGetCachedIssues.mockResolvedValue(cachedData);
    mockIsCacheFresh.mockReturnValue(false);

    const newIssues = [{ number: 99, title: 'New' }];

    const { axios: freshAxios, fetchIssues: freshFetchIssues } = requireFresh();
    freshAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      data: newIssues,
      headers: { etag: '"new-etag"' },
    });

    const result = await freshFetchIssues('owner', 'repo', 3600);

    expect(result).toEqual(newIssues);
    expect(mockCacheIssues).toHaveBeenCalledWith('owner', 'repo', newIssues, 3600, '"new-etag"');
  });

  test('does full fetch when stale cache has no ETag', async () => {
    const cachedData = { issues: mockIssues, etag: null, cachedAt: 1000 };
    mockGetCachedIssues.mockResolvedValue(cachedData);
    mockIsCacheFresh.mockReturnValue(false);

    const { axios: freshAxios, fetchIssues: freshFetchIssues } = requireFresh();
    freshAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      data: mockIssues,
      headers: { etag: '"fresh-etag"' },
    });

    const result = await freshFetchIssues('owner', 'repo', 3600);

    // Should NOT send If-None-Match
    expect(freshAxios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.not.objectContaining({ 'If-None-Match': expect.anything() }),
      })
    );
    expect(result).toEqual(mockIssues);
    expect(mockCacheIssues).toHaveBeenCalledWith('owner', 'repo', mockIssues, 3600, '"fresh-etag"');
  });

  test('does full fetch when no cache exists', async () => {
    mockGetCachedIssues.mockResolvedValue(null);

    const { axios: freshAxios, fetchIssues: freshFetchIssues } = requireFresh();
    freshAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      data: mockIssues,
      headers: { etag: '"first-etag"' },
    });

    const result = await freshFetchIssues('owner', 'repo', 3600);

    expect(result).toEqual(mockIssues);
    expect(mockCacheIssues).toHaveBeenCalledWith('owner', 'repo', mockIssues, 3600, '"first-etag"');
  });

  test('stores null etag when response has no etag header', async () => {
    mockGetCachedIssues.mockResolvedValue(null);

    const { axios: freshAxios, fetchIssues: freshFetchIssues } = requireFresh();
    freshAxios.get = jest.fn().mockResolvedValue({
      status: 200,
      data: mockIssues,
      headers: {},
    });

    await freshFetchIssues('owner', 'repo', 3600);

    expect(mockCacheIssues).toHaveBeenCalledWith('owner', 'repo', mockIssues, 3600, null);
  });

  test('includes both auth and ETag headers when GITHUB_TOKEN is set', async () => {
    process.env.GITHUB_TOKEN = 'test-token';
    const cachedData = { issues: mockIssues, etag: '"etag-456"', cachedAt: 1000 };
    mockGetCachedIssues.mockResolvedValue(cachedData);
    mockIsCacheFresh.mockReturnValue(false);

    const { axios: freshAxios, fetchIssues: freshFetchIssues } = requireFresh();
    freshAxios.get = jest.fn().mockResolvedValue({
      status: 304,
      data: null,
      headers: {},
    });

    await freshFetchIssues('owner', 'repo', 3600);

    expect(freshAxios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token',
          'If-None-Match': '"etag-456"',
        }),
      })
    );
  });
});
