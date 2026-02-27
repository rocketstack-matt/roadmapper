const axios = require('axios');

// Layout constants
const COLUMN_HEADER_HEIGHT = 130;
const CARD_SLOT_HEIGHT = 95;
const GROUP_HEADER_HEIGHT = 35;
const INTER_GROUP_GAP = 10;
const GROUP_LABEL_PREFIX = 'Roadmap Group: ';
const UNGROUPED_LABEL = 'Other';

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
  const totalIssues = groupedData.groups.reduce((sum, g) => sum + g.issues.length, 0) + groupedData.ungrouped.length;
  const numGroups = groupedData.groups.length;
  const interGroupGaps = Math.max(0, numGroups - 1)
    + (groupedData.ungrouped.length > 0 && numGroups > 0 ? 1 : 0);

  return COLUMN_HEADER_HEIGHT
    + numGroups * GROUP_HEADER_HEIGHT
    + interGroupGaps * INTER_GROUP_GAP
    + totalIssues * CARD_SLOT_HEIGHT;
};

// Build global layout that synchronizes group bands across all three columns
const buildGlobalLayout = (columns) => {
  const cols = [columns.now, columns.next, columns.later];

  // Check if any column has groups
  const hasAnyGroups = cols.some(col => col.groups.length > 0);

  if (!hasAnyGroups) {
    // No grouping - flat layout (backward compatible)
    const maxCards = Math.max(...cols.map(col => col.ungrouped.length));
    return {
      hasGroups: false,
      bands: [],
      ungroupedBand: null,
      totalHeight: COLUMN_HEADER_HEIGHT + maxCards * CARD_SLOT_HEIGHT
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

    bands.push({
      name,
      color: groupInfo.get(name),
      yStart: y,
      maxCards,
      bandHeight: GROUP_HEADER_HEIGHT + maxCards * CARD_SLOT_HEIGHT
    });

    y += GROUP_HEADER_HEIGHT + maxCards * CARD_SLOT_HEIGHT;
  }

  // Ungrouped band (labeled "Other")
  const hasUngrouped = cols.some(col => col.ungrouped.length > 0);
  let ungroupedBand = null;

  if (hasUngrouped) {
    y += INTER_GROUP_GAP;
    const maxUngroupedCards = Math.max(...cols.map(col => col.ungrouped.length));
    ungroupedBand = {
      name: UNGROUPED_LABEL,
      color: null,
      yStart: y,
      maxCards: maxUngroupedCards,
      bandHeight: GROUP_HEADER_HEIGHT + maxUngroupedCards * CARD_SLOT_HEIGHT
    };
    y += ungroupedBand.bandHeight;
  }

  return {
    hasGroups: true,
    bands,
    ungroupedBand,
    totalHeight: y
  };
};

const createColumn = (title, subtitle, groupedData, xPosition, className, layout, headerColor, subheaderColor, backgroundColor, cardBackground, cardTextColor, shadowColor, hoverShadowColor) => {
  let cardsSvg = '';

  const renderCard = (issue, yPos) => {
    const labelColor = issue.labelColor ? `#${issue.labelColor}` : '#8b949e';
    return `
      <a href="${issue.html_url}" target="_blank" rel="noopener noreferrer">
        <g transform="translate(0, ${yPos})" class="roadmap-card" style="cursor: pointer;">
          <rect x="15" y="0" width="350" height="75" rx="8" ry="8" style="fill: ${cardBackground}; filter: drop-shadow(0 1px 3px ${shadowColor});"></rect>
          <rect x="15" y="0" width="350" height="4" rx="8" ry="8" style="fill: ${labelColor};"></rect>
          <foreignObject x="25" y="15" width="330" height="55" style="pointer-events: none;">
            <body xmlns="http://www.w3.org/1999/xhtml" style="margin: 0;">
              <div style="font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 500; color: ${cardTextColor}; line-height: 1.4; padding: 8px 10px; word-wrap: break-word; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${issue.title}</div>
            </body>
          </foreignObject>
        </g>
      </a>`;
  };

  if (!layout.hasGroups) {
    // No groups anywhere - flat rendering (backward compatible)
    let y = COLUMN_HEADER_HEIGHT;
    groupedData.ungrouped.forEach(issue => {
      cardsSvg += renderCard(issue, y);
      y += CARD_SLOT_HEIGHT;
    });
  } else {
    // Render cards at synchronized global band positions (containers rendered at SVG root)
    for (const band of layout.bands) {
      const group = groupedData.groups.find(g => g.name === band.name);
      if (group) {
        let y = band.yStart + GROUP_HEADER_HEIGHT;
        group.issues.forEach(issue => {
          cardsSvg += renderCard(issue, y);
          y += CARD_SLOT_HEIGHT;
        });
      }
    }

    // Render ungrouped cards
    if (layout.ungroupedBand) {
      let y = layout.ungroupedBand.yStart + GROUP_HEADER_HEIGHT;
      groupedData.ungrouped.forEach(issue => {
        cardsSvg += renderCard(issue, y);
        y += CARD_SLOT_HEIGHT;
      });
    }
  }

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

    // Filter issues and extract label colors
    const filterAndExtractColor = (labelName) => {
        return issues.filter(issue => {
            const label = issue.labels.find(l => l.name === labelName);
            if (label) {
                issue.labelColor = label.color;
                return true;
            }
            return false;
        });
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
      const renderFullWidthContainer = (name, color, yStart, maxCards) => {
        const groupColor = color ? `#${color}` : '#8b949e';
        const containerHeight = maxCards > 0
          ? GROUP_HEADER_HEIGHT + maxCards * CARD_SLOT_HEIGHT - 12
          : 28;
        return `
      <rect x="5" y="${yStart}" width="1130" height="${containerHeight}" rx="12" ry="12" style="fill: ${cardBackground}; filter: drop-shadow(0 1px 3px ${shadowColor});"></rect>
      <text x="570" y="${yStart + 22}" style="font-size: 13px; text-anchor: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 600; fill: ${headerColor}; opacity: 0.7;">${name}</text>`;
      };

      for (const band of layout.bands) {
        groupContainersSvg += renderFullWidthContainer(band.name, band.color, band.yStart, band.maxCards);
      }
      if (layout.ungroupedBand) {
        groupContainersSvg += renderFullWidthContainer(layout.ungroupedBand.name, layout.ungroupedBand.color, layout.ungroupedBand.yStart, layout.ungroupedBand.maxCards);
      }
    }

    return `
    <svg viewBox="0 0 1140 ${svgHeight}" xmlns="http://www.w3.org/2000/svg" overflow="hidden" style="background-color: ${backgroundColor};">
      <defs>
        <style>
          .roadmap-card:hover rect:first-child {
            filter: drop-shadow(0 4px 12px ${hoverShadowColor});
          }
        </style>
      </defs>
      ${groupContainersSvg}
      ${createColumn('Now', "We're working on it right now", columns.now, 0, 'now', layout, headerColor, subheaderColor, backgroundColor, cardBackground, cardTextColor, shadowColor, hoverShadowColor)}
      ${createColumn('Next', "Coming up next", columns.next, 380, 'next', layout, headerColor, subheaderColor, backgroundColor, cardBackground, cardTextColor, shadowColor, hoverShadowColor)}
      ${createColumn('Later', "On the horizon", columns.later, 760, 'later', layout, headerColor, subheaderColor, backgroundColor, cardBackground, cardTextColor, shadowColor, hoverShadowColor)}
      <text x="570" y="${footerY + 15}" style="font-size: 12px; text-anchor: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 400; fill: ${subheaderColor};">Roadmaps are cached for 60 minutes</text>
    </svg>
  `;
};

const fetchIssues = async (owner, repo, cacheTtlSeconds) => {
    // Check cache first (if caching is available)
    if (cacheTtlSeconds) {
        const { getCachedIssues, cacheIssues } = require('./lib/cache');
        const cached = await getCachedIssues(owner, repo);
        if (cached) {
            return cached;
        }

        const headers = {};
        if (process.env.GITHUB_TOKEN) {
            headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
        }

        const response = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/issues?per_page=100`,
            { headers }
        );

        await cacheIssues(owner, repo, response.data, cacheTtlSeconds);
        return response.data;
    }

    // No caching — fetch directly from GitHub
    const headers = {};
    if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/issues?per_page=100`,
        { headers }
    );
    return response.data;
};

module.exports = {
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
};
