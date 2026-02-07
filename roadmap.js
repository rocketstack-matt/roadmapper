const axios = require('axios');

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

const createColumn = (title, subtitle, items, xPosition, className, headerColor, subheaderColor, backgroundColor, cardBackground, cardTextColor, shadowColor, hoverShadowColor) => `
  <g transform="translate(${xPosition}, 0)" class="${className}">
    <!-- Column background -->
    <rect x="0" y="0" width="380" height="100%" style="fill: ${backgroundColor}; opacity: 0.03;"></rect>

    <!-- Column header -->
    <text x="190" y="40" style="font-size: 24px; text-anchor: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 700; fill: ${headerColor}; letter-spacing: -0.5px;">${title}</text>

    <!-- Subtitle -->
    <foreignObject x="20" y="55" width="340" height="60">
      <body xmlns="http://www.w3.org/1999/xhtml" style="margin: 0;">
        <div style="font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 400; color: ${subheaderColor}; text-align: center; line-height: 1.5; padding: 0 10px;">${subtitle}</div>
      </body>
    </foreignObject>

    <!-- Issues -->
    ${items.map((issue, index) => {
      // Get the label color from the issue's roadmap label
      const labelColor = issue.labelColor ? `#${issue.labelColor}` : '#8b949e';

      return `
      <a href="${issue.html_url}" target="_blank" rel="noopener noreferrer">
        <g transform="translate(0, ${(index * 95) + 130})" class="roadmap-card" style="cursor: pointer;">
          <!-- Card background -->
          <rect x="15" y="0" width="350" height="75" rx="8" ry="8" style="fill: ${cardBackground}; filter: drop-shadow(0 1px 3px ${shadowColor});"></rect>

          <!-- Top accent border -->
          <rect x="15" y="0" width="350" height="4" rx="8" ry="8" style="fill: ${labelColor};"></rect>

          <!-- Issue content -->
          <foreignObject x="25" y="15" width="330" height="55" style="pointer-events: none;">
            <body xmlns="http://www.w3.org/1999/xhtml" style="margin: 0;">
              <div style="font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 500; color: ${cardTextColor}; line-height: 1.4; padding: 8px 10px; word-wrap: break-word; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${issue.title}</div>
            </body>
          </foreignObject>
        </g>
      </a>
    `;
    }).join('')}
  </g>
`;

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
        now: filterAndExtractColor('Roadmap: Now'),
        later: filterAndExtractColor('Roadmap: Later'),
        future: filterAndExtractColor('Roadmap: Future')
    };

    const maxItemsCount = Math.max(columns.now.length, columns.later.length, columns.future.length);
    const svgHeight = 140 + (maxItemsCount * 95);

    return `
    <svg viewBox="0 0 1140 ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="background-color: ${backgroundColor};">
      <defs>
        <style>
          .roadmap-card:hover rect:first-child {
            filter: drop-shadow(0 4px 12px ${hoverShadowColor});
          }
        </style>
      </defs>
      ${createColumn('Now', "We're working on it right now", columns.now, 0, 'now', headerColor, subheaderColor, backgroundColor, cardBackground, cardTextColor, shadowColor, hoverShadowColor)}
      ${createColumn('Later', "Next up on our roadmap", columns.later, 380, 'later', headerColor, subheaderColor, backgroundColor, cardBackground, cardTextColor, shadowColor, hoverShadowColor)}
      ${createColumn('Future', "Planned for the future", columns.future, 760, 'future', headerColor, subheaderColor, backgroundColor, cardBackground, cardTextColor, shadowColor, hoverShadowColor)}
    </svg>
  `;
};

const fetchIssues = async (owner, repo) => {
    const headers = {};

    // Add authentication if GitHub token is available
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
    hexToRgba
};
