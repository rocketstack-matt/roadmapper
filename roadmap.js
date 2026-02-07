const axios = require('axios');

const createColumn = (title, subtitle, items, xPosition, className, accentColor, headerColor, subheaderColor, backgroundColor) => `
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
    ${items.map((issue, index) => `
      <g transform="translate(0, ${(index * 95) + 130})">
        <!-- Card background -->
        <rect x="15" y="0" width="350" height="75" rx="8" ry="8" style="fill: #ffffff; filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.08));"></rect>

        <!-- Top accent border -->
        <rect x="15" y="0" width="350" height="4" rx="8" ry="8" style="fill: ${accentColor};"></rect>

        <!-- Issue content -->
        <foreignObject x="25" y="15" width="330" height="55">
          <body xmlns="http://www.w3.org/1999/xhtml" style="margin: 0;">
            <a href="${issue.html_url}" target="_blank" style="text-decoration: none; display: block;">
              <div style="font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 500; color: #24292f; line-height: 1.4; padding: 8px 10px; word-wrap: break-word; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${issue.title}</div>
            </a>
          </body>
        </foreignObject>
      </g>
    `).join('')}
  </g>
`;

const generateRoadmapSVG = (issues, colorScheme) => {
    // Sort issues by number
    issues.sort((a, b) => a.number - b.number);

    let headerColor, subheaderColor, backgroundColor;
    if (colorScheme === 'light') {
        headerColor = '#ffffff';
        subheaderColor = 'rgba(255, 255, 255, 0.8)';
        backgroundColor = '#f6f8fa';
    } else { // default to dark
        headerColor = '#24292f';
        subheaderColor = '#57606a';
        backgroundColor = '#ffffff';
    }

    const columns = {
        now: issues.filter(issue => issue.labels.some(label => label.name === 'Roadmap: Now')),
        later: issues.filter(issue => issue.labels.some(label => label.name === 'Roadmap: Later')),
        future: issues.filter(issue => issue.labels.some(label => label.name === 'Roadmap: Future'))
    };

    const maxItemsCount = Math.max(columns.now.length, columns.later.length, columns.future.length);
    const svgHeight = 140 + (maxItemsCount * 95);

    return `
    <svg viewBox="0 0 1140 ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="background-color: ${backgroundColor};">
      <defs>
        <style>
          .roadmap-card:hover rect:first-child {
            filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.12));
          }
        </style>
      </defs>
      ${createColumn('Now', "We're working on it right now", columns.now, 0, 'now', '#2da44e', headerColor, subheaderColor, backgroundColor)}
      ${createColumn('Later', "Next up on our roadmap", columns.later, 380, 'later', '#fb8500', headerColor, subheaderColor, backgroundColor)}
      ${createColumn('Future', "Planned for the future", columns.future, 760, 'future', '#8b949e', headerColor, subheaderColor, backgroundColor)}
    </svg>
  `;
};

const fetchIssues = async (owner, repo) => {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/issues?per_page=100`);
    return response.data;
};

module.exports = {
    generateRoadmapSVG,
    fetchIssues
};
