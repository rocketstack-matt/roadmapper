const axios = require('axios');

// Layout constants
const COLUMN_HEADER_HEIGHT = 130;
const CARD_MIN_HEIGHT = 75; // fits CARD_MIN_LINES of title text
const CARD_MIN_LINES = 2;
const CARD_LINE_HEIGHT = 20; // each title line beyond CARD_MIN_LINES grows the card by this
const CARD_GAP = 20;
const CARD_SLOT_HEIGHT = CARD_MIN_HEIGHT + CARD_GAP; // smallest card plus the gap below it
const CARD_TEXT_WIDTH = 310;
const CARD_FONT_SIZE = 14;
const GROUP_HEADER_HEIGHT = 35;
const INTER_GROUP_GAP = 10;
const GROUP_LABEL_PREFIX = 'Roadmap Group: ';
const UNGROUPED_LABEL = 'Other';
const COLUMN_KEYS = ['now', 'next', 'later'];

// Advance widths (in em) of the card title font at weight 500, measured from
// SF Pro — what -apple-system resolves to, and the widest font in the card's
// font-family stack — so wrap estimates err towards an extra line rather than
// clipped text. Kerning only narrows real text, which also errs safe.
const CHAR_WIDTHS = {
  ' ': 0.263, '!': 0.315, '"': 0.497, '#': 0.633, '$': 0.633, '%': 0.951, '&': 0.712, "'": 0.303,
  '(': 0.387, ')': 0.387, '*': 0.465, '+': 0.633, ',': 0.303, '-': 0.465, '.': 0.303, '/': 0.304,
  '0': 0.637, '1': 0.469, '2': 0.606, '3': 0.630, '4': 0.648, '5': 0.623, '6': 0.642, '7': 0.589,
  '8': 0.647, '9': 0.642, ':': 0.303, ';': 0.303, '<': 0.633, '=': 0.633, '>': 0.633, '?': 0.517,
  '@': 0.910, 'A': 0.683, 'B': 0.659, 'C': 0.713, 'D': 0.723, 'E': 0.594, 'F': 0.570, 'G': 0.740,
  'H': 0.745, 'I': 0.274, 'J': 0.548, 'K': 0.665, 'L': 0.566, 'M': 0.874, 'N': 0.740, 'O': 0.766,
  'P': 0.637, 'Q': 0.766, 'R': 0.656, 'S': 0.639, 'T': 0.632, 'U': 0.734, 'V': 0.679, 'W': 0.971,
  'X': 0.685, 'Y': 0.662, 'Z': 0.656, '[': 0.387, '\\': 0.304, ']': 0.387, '^': 0.633, '_': 0.550,
  '`': 0.489, 'a': 0.554, 'b': 0.616, 'c': 0.558, 'd': 0.616, 'e': 0.570, 'f': 0.368, 'g': 0.611,
  'h': 0.592, 'i': 0.250, 'j': 0.250, 'k': 0.552, 'l': 0.256, 'm': 0.880, 'n': 0.587, 'o': 0.590,
  'p': 0.612, 'q': 0.611, 'r': 0.396, 's': 0.518, 't': 0.371, 'u': 0.587, 'v': 0.545, 'w': 0.788,
  'x': 0.532, 'y': 0.550, 'z': 0.538, '{': 0.387, '|': 0.262, '}': 0.387, '~': 0.633
};
const DEFAULT_CHAR_WIDTH = 0.65; // accented Latin, Greek, Cyrillic, etc.
const WIDE_CHAR_WIDTH = 1.0; // CJK, emoji and other full-width characters

const charWidth = (ch) => {
  const em = CHAR_WIDTHS[ch] ?? (ch.codePointAt(0) >= 0x1100 ? WIDE_CHAR_WIDTH : DEFAULT_CHAR_WIDTH);
  return em * CARD_FONT_SIZE;
};

// Estimate how many lines a card title wraps to. SVG can't size a box to fit
// its text, so card heights are computed here by replaying the browser's
// greedy word wrap, breaking mid-word only when a word is wider than a whole
// line (word-wrap: break-word).
const estimateTitleLines = (title) => {
  const spaceWidth = charWidth(' ');
  let lines = 1;
  let lineWidth = 0;

  for (const word of String(title || '').trim().split(/\s+/)) {
    const chars = Array.from(word);
    const wordWidth = chars.reduce((sum, ch) => sum + charWidth(ch), 0);

    if (lineWidth > 0 && lineWidth + spaceWidth + wordWidth <= CARD_TEXT_WIDTH) {
      lineWidth += spaceWidth + wordWidth;
      continue;
    }
    if (lineWidth > 0) {
      lines++;
      lineWidth = 0;
    }
    if (wordWidth <= CARD_TEXT_WIDTH) {
      lineWidth = wordWidth;
      continue;
    }
    for (const ch of chars) {
      if (lineWidth + charWidth(ch) > CARD_TEXT_WIDTH) {
        lines++;
        lineWidth = 0;
      }
      lineWidth += charWidth(ch);
    }
  }

  return lines;
};

// Line count and height of an issue's card. Titles of CARD_MIN_LINES or fewer
// get the standard card; longer titles grow it a line at a time.
const measureCard = (issue) => {
  const lines = Math.max(CARD_MIN_LINES, estimateTitleLines(issue.title));
  return { lines, height: CARD_MIN_HEIGHT + (lines - CARD_MIN_LINES) * CARD_LINE_HEIGHT };
};

// The labels that classify an issue into a roadmap column. fetchIssues queries
// GitHub for each of these separately (the labels query param is AND-only, so
// they can't be OR'd in one request) and merges the results.
const ROADMAP_LABELS = ['Roadmap: Now', 'Roadmap: Next', 'Roadmap: Later'];

// Validate hex color (3 or 6 digits)
const validateHexColor = (color) => {
  if (!color) return null;
  const cleanColor = color.replace(/^#/, '');
  const isValid = /^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(cleanColor);
  return isValid ? cleanColor : null;
};

// Normalize 3-digit hex to 6-digit
const normalizeHex = (hex) => {
  if (hex.length === 3) {
    return hex.split('').map(c => c + c).join('');
  }
  return hex;
};

// Convert hex to rgba with alpha
const hexToRgba = (hex, alpha) => {
  const normalized = normalizeHex(hex);
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Escape text for interpolation into SVG/HTML markup and attribute values.
// Issue titles and label names are user-controlled, so they must never be
// written into markup raw.
const escapeXml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Group issues by 'Roadmap Group: *' labels within a column
const groupIssues = (issues) => {
  const groupMap = new Map();
  const ungrouped = [];

  for (const issue of issues) {
    const groupLabel = issue.labels.find(l => l.name.startsWith(GROUP_LABEL_PREFIX));
    if (groupLabel) {
      const groupName = groupLabel.name.slice(GROUP_LABEL_PREFIX.length);
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, { name: groupName, color: groupLabel.color, issues: [] });
      }
      groupMap.get(groupName).issues.push(issue);
    } else {
      ungrouped.push(issue);
    }
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  return { groups, ungrouped };
};

// Calculate total column content height for a grouped column (kept for backward compat)
const calculateColumnHeight = (groupedData) => {
  const allIssues = [...groupedData.groups.flatMap(g => g.issues), ...groupedData.ungrouped];
  const numGroups = groupedData.groups.length;
  const interGroupGaps = Math.max(0, numGroups - 1)
    + (groupedData.ungrouped.length > 0 && numGroups > 0 ? 1 : 0);

  return COLUMN_HEADER_HEIGHT
    + numGroups * GROUP_HEADER_HEIGHT
    + interGroupGaps * INTER_GROUP_GAP
    + allIssues.reduce((sum, issue) => sum + measureCard(issue).height + CARD_GAP, 0);
};

// Build global layout that synchronizes group bands across all three columns.
// Also returns `cards`: each column's card positions ({ issue, y, height, lines })
// in render order — the single source of card geometry for the SVG and the
// embed/html image maps.
const buildGlobalLayout = (columns) => {
  const cols = [columns.now, columns.next, columns.later];
  const cards = { now: [], next: [], later: [] };

  // Stack a column's issues downward from yStart, recording each card's
  // position, and return the stack's height (each card plus the gap below it).
  const stackCards = (key, issues, yStart) => {
    let y = yStart;
    for (const issue of issues) {
      const { lines, height } = measureCard(issue);
      cards[key].push({ issue, y, height, lines });
      y += height + CARD_GAP;
    }
    return y - yStart;
  };

  // Check if any column has groups
  const hasAnyGroups = cols.some(col => col.groups.length > 0);

  if (!hasAnyGroups) {
    // No grouping - flat layout (backward compatible)
    const maxStackHeight = Math.max(...COLUMN_KEYS.map(key => stackCards(key, columns[key].ungrouped, COLUMN_HEADER_HEIGHT)));
    return {
      hasGroups: false,
      bands: [],
      ungroupedBand: null,
      cards,
      totalHeight: COLUMN_HEADER_HEIGHT + maxStackHeight
    };
  }

  // Collect all unique group names and their colors
  const groupInfo = new Map();
  for (const col of cols) {
    for (const group of col.groups) {
      if (!groupInfo.has(group.name)) {
        groupInfo.set(group.name, group.color);
      }
    }
  }

  const sortedGroupNames = Array.from(groupInfo.keys()).sort();

  // Build bands - each band spans all columns at the same Y position
  const bands = [];
  let y = COLUMN_HEADER_HEIGHT;

  for (let i = 0; i < sortedGroupNames.length; i++) {
    const name = sortedGroupNames[i];
    if (i > 0) y += INTER_GROUP_GAP;

    const getGroupCardCount = (colData, groupName) => {
      const group = colData.groups.find(g => g.name === groupName);
      return group ? group.issues.length : 0;
    };

    const maxCards = Math.max(...cols.map(col => getGroupCardCount(col, name)));
    const maxStackHeight = Math.max(...COLUMN_KEYS.map(key => {
      const group = columns[key].groups.find(g => g.name === name);
      return group ? stackCards(key, group.issues, y + GROUP_HEADER_HEIGHT) : 0;
    }));

    bands.push({
      name,
      color: groupInfo.get(name),
      yStart: y,
      maxCards,
      bandHeight: GROUP_HEADER_HEIGHT + maxStackHeight
    });

    y += GROUP_HEADER_HEIGHT + maxStackHeight;
  }

  // Ungrouped band (labeled "Other")
  const hasUngrouped = cols.some(col => col.ungrouped.length > 0);
  let ungroupedBand = null;

  if (hasUngrouped) {
    y += INTER_GROUP_GAP;
    const maxUngroupedCards = Math.max(...cols.map(col => col.ungrouped.length));
    const maxStackHeight = Math.max(...COLUMN_KEYS.map(key => stackCards(key, columns[key].ungrouped, y + GROUP_HEADER_HEIGHT)));
    ungroupedBand = {
      name: UNGROUPED_LABEL,
      color: null,
      yStart: y,
      maxCards: maxUngroupedCards,
      bandHeight: GROUP_HEADER_HEIGHT + maxStackHeight
    };
    y += ungroupedBand.bandHeight;
  }

  return {
    hasGroups: true,
    bands,
    ungroupedBand,
    cards,
    totalHeight: y
  };
};

const createColumn = (title, subtitle, cards, xPosition, className, headerColor, subheaderColor, backgroundColor, cardBackground, cardTextColor, shadowColor, hoverShadowColor) => {
  // The title box sits inside the card (x 35, y 23) and is exactly `lines`
  // tall, with no padding: lines past the clamp would otherwise render into
  // the padding and show half-cut under the ellipsis.
  const renderCard = ({ issue, y, height, lines }) => {
    const labelColor = issue.labelColor ? `#${issue.labelColor}` : '#8b949e';
    return `
      <a href="${escapeXml(issue.html_url)}" target="_blank" rel="noopener noreferrer">
        <g transform="translate(0, ${y})" class="roadmap-card" style="cursor: pointer; --accent-color: ${labelColor};">
          <rect x="15" y="0" width="350" height="${height}" rx="8" ry="8" style="fill: ${cardBackground}; filter: drop-shadow(0 1px 3px ${shadowColor});"></rect>
          <rect x="15" y="0" width="350" height="4" rx="8" ry="8" style="fill: ${labelColor};"></rect>
          <foreignObject x="35" y="23" width="${CARD_TEXT_WIDTH}" height="${lines * CARD_LINE_HEIGHT}" style="pointer-events: none;">
            <body xmlns="http://www.w3.org/1999/xhtml" style="margin: 0;">
              <div style="font-size: ${CARD_FONT_SIZE}px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 500; color: ${cardTextColor}; line-height: ${CARD_LINE_HEIGHT}px; word-wrap: break-word; overflow: hidden; display: -webkit-box; -webkit-line-clamp: ${lines}; -webkit-box-orient: vertical; pointer-events: none; cursor: pointer; user-select: none;">${escapeXml(issue.title)}</div>
            </body>
          </foreignObject>
        </g>
      </a>`;
  };

  // Cards are positioned by buildGlobalLayout (group containers are rendered at the SVG root)
  const cardsSvg = cards.map(renderCard).join('');

  return `
  <g transform="translate(${xPosition}, 0)" class="${className}">
    <text x="190" y="40" style="font-size: 24px; text-anchor: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 700; fill: ${headerColor}; letter-spacing: -0.5px;">${title}</text>
    <foreignObject x="20" y="55" width="340" height="60">
      <body xmlns="http://www.w3.org/1999/xhtml" style="margin: 0;">
        <div style="font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 400; color: ${subheaderColor}; text-align: center; line-height: 1.5; padding: 0 10px;">${subtitle}</div>
      </body>
    </foreignObject>
    ${cardsSvg}
  </g>`;
};

const generateRoadmapSVG = (issues, bgColor, textColor) => {
    // Sort issues by number
    issues.sort((a, b) => a.number - b.number);

    // Validate and normalize colors
    const bg = normalizeHex(validateHexColor(bgColor) || 'ffffff');
    const text = normalizeHex(validateHexColor(textColor) || '24292f');

    // Calculate derived colors
    const backgroundColor = `#${bg}`;
    const cardBackground = `#${bg}`;
    const headerColor = `#${text}`;
    const subheaderColor = hexToRgba(text, 0.7);
    const cardTextColor = `#${text}`;
    const shadowColor = hexToRgba(text, 0.08);
    const hoverShadowColor = hexToRgba(text, 0.12);

    // Filter issues for a column and attach that column's label color. Returns
    // a shallow copy per issue rather than mutating the shared issue object —
    // an issue can carry more than one roadmap label (see fetchRoadmapIssues),
    // so mutating in place would leak the last-processed column's color into
    // every column the issue appears in.
    const filterAndExtractColor = (labelName) => {
        return issues
            .filter(issue => issue.labels.some(l => l.name === labelName))
            .map(issue => ({ ...issue, labelColor: issue.labels.find(l => l.name === labelName).color }));
    };

    const columns = {
        now: groupIssues(filterAndExtractColor('Roadmap: Now')),
        next: groupIssues(filterAndExtractColor('Roadmap: Next')),
        later: groupIssues(filterAndExtractColor('Roadmap: Later'))
    };

    const layout = buildGlobalLayout(columns);

    const footerY = layout.totalHeight + 10;
    const svgHeight = footerY + 30;

    // Render full-width group containers (behind column content)
    let groupContainersSvg = '';
    if (layout.hasGroups) {
      const renderFullWidthContainer = (name, color, yStart, maxCards, bandHeight) => {
        const groupColor = color ? `#${color}` : '#8b949e';
        const containerHeight = maxCards > 0
          ? bandHeight - 12
          : 28;
        return `
      <rect x="5" y="${yStart}" width="1130" height="${containerHeight}" rx="12" ry="12" style="fill: ${cardBackground}; filter: drop-shadow(0 1px 3px ${shadowColor});"></rect>
      <text x="570" y="${yStart + 22}" style="font-size: 13px; text-anchor: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 600; fill: ${headerColor}; opacity: 0.7;">${escapeXml(name)}</text>`;
      };

      for (const band of layout.bands) {
        groupContainersSvg += renderFullWidthContainer(band.name, band.color, band.yStart, band.maxCards, band.bandHeight);
      }
      if (layout.ungroupedBand) {
        groupContainersSvg += renderFullWidthContainer(layout.ungroupedBand.name, layout.ungroupedBand.color, layout.ungroupedBand.yStart, layout.ungroupedBand.maxCards, layout.ungroupedBand.bandHeight);
      }
    }

    return `
    <svg viewBox="0 0 1140 ${svgHeight}" xmlns="http://www.w3.org/2000/svg" overflow="hidden" style="background-color: ${backgroundColor};">
      <defs>
        <style>
          .roadmap-card:hover rect:first-child {
            filter: drop-shadow(0 4px 12px ${hoverShadowColor});
            stroke: var(--accent-color);
            stroke-width: 2px;
          }
        </style>
      </defs>
      ${groupContainersSvg}
      ${createColumn('Now', "We're working on it right now", layout.cards.now, 0, 'now', headerColor, subheaderColor, backgroundColor, cardBackground, cardTextColor, shadowColor, hoverShadowColor)}
      ${createColumn('Next', "Coming up next", layout.cards.next, 380, 'next', headerColor, subheaderColor, backgroundColor, cardBackground, cardTextColor, shadowColor, hoverShadowColor)}
      ${createColumn('Later', "On the horizon", layout.cards.later, 760, 'later', headerColor, subheaderColor, backgroundColor, cardBackground, cardTextColor, shadowColor, hoverShadowColor)}
      <text x="570" y="${footerY + 15}" style="font-size: 12px; text-anchor: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 400; fill: ${subheaderColor};">Roadmaps are cached for 60 minutes</text>
    </svg>
  `;
};

// Keep only the fields the renderer needs (number, title, html_url, and label
// name/color). Applied before caching/returning to cut Redis memory and
// network transfer (~90% payload reduction for typical repos).
const stripIssueFields = (issues) => {
    return issues.map(issue => ({
        number: issue.number,
        title: issue.title,
        html_url: issue.html_url,
        labels: issue.labels.map(label => ({
            name: label.name,
            color: label.color,
        })),
    }));
};

// Fetch every open issue carrying a given label, following pagination until a
// page returns fewer than per_page results. The GitHub /issues endpoint also
// returns pull requests (PRs are issues in GitHub's model), so items with a
// `pull_request` field are excluded — only real issues belong on the roadmap.
const fetchIssuesForLabel = async (owner, repo, label, headers) => {
    const issues = [];
    let page = 1;
    while (true) {
        const response = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=100&page=${page}`,
            { headers }
        );
        issues.push(...response.data.filter(issue => !issue.pull_request));
        // Paginate on the raw page size — PRs still count toward GitHub's page.
        if (response.data.length < 100) break;
        page++;
    }
    return issues;
};

// Fetch the open issues for every roadmap label and merge them, deduping by
// issue number (an issue may carry more than one roadmap label). The merged
// result is stripped to the fields the renderer needs before being returned.
const fetchRoadmapIssues = async (owner, repo) => {
    const headers = {};
    if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    // Fetch the (small, fixed) label set concurrently to cut latency.
    const perLabel = await Promise.all(
        ROADMAP_LABELS.map(label => fetchIssuesForLabel(owner, repo, label, headers))
    );

    const byNumber = new Map();
    for (const issues of perLabel) {
        for (const issue of issues) {
            byNumber.set(issue.number, issue);
        }
    }
    return stripIssueFields(Array.from(byNumber.values()));
};

const fetchIssues = async (owner, repo, cacheTtlSeconds) => {
    const debug = process.env.VERCEL_ENV !== 'production';
    const tag = `[cache ${owner}/${repo}]`;

    // Check cache first (if caching is available)
    if (cacheTtlSeconds) {
        const { getCachedIssues, cacheIssues, isCacheFresh } = require('./lib/cache');
        const cached = await getCachedIssues(owner, repo);

        // Fresh cache — return immediately, no API call
        if (cached && isCacheFresh(cached, cacheTtlSeconds)) {
            if (debug) console.log(`${tag} FRESH — returning cached issues (ttl=${cacheTtlSeconds}s)`);
            // Strip on read too, in case the entry was cached before stripping existed.
            return stripIssueFields(cached.issues);
        }

        if (debug) console.log(`${tag} ${cached ? 'STALE' : 'MISS'} — fetching roadmap issues`);
        const issues = await fetchRoadmapIssues(owner, repo);
        if (debug) console.log(`${tag} fetched ${issues.length} roadmap issues — caching`);
        await cacheIssues(owner, repo, issues, cacheTtlSeconds);
        return issues;
    }

    // No caching — fetch directly from GitHub
    return fetchRoadmapIssues(owner, repo);
};

module.exports = {
    generateRoadmapSVG,
    fetchIssues,
    stripIssueFields,
    validateHexColor,
    normalizeHex,
    hexToRgba,
    escapeXml,
    groupIssues,
    buildGlobalLayout,
    calculateColumnHeight,
    estimateTitleLines,
    COLUMN_HEADER_HEIGHT,
    CARD_SLOT_HEIGHT,
    CARD_MIN_HEIGHT,
    CARD_LINE_HEIGHT,
    CARD_GAP,
    GROUP_HEADER_HEIGHT,
    INTER_GROUP_GAP,
    GROUP_LABEL_PREFIX,
    UNGROUPED_LABEL
};
