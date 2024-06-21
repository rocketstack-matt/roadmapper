const axios = require('axios');

const createColumn = (title, subtitle, items, xPosition, className, backgroundColor, bandColor, headerColor, subheaderColor) => `
  <g transform="translate(${xPosition}, 40)" class="${className}">
    <text x="190" y="-20" style="font-size: 20px; text-anchor: middle; font-family: Arial, sans-serif; font-weight: bold; fill: ${headerColor};">${title}</text>
    <foreignObject x="10" y="0" width="380" height="40">
      <body xmlns="http://www.w3.org/1999/xhtml" style="margin: 0;">
        <div style="font-size: 14px; font-family: Arial, sans-serif; font-weight: normal; color: ${subheaderColor}; text-align: center; word-wrap: break-word;">${subtitle}</div>
      </body>
    </foreignObject>
    ${items.map((issue, index) => `
      <g transform="translate(0, ${(index * 80) + 70})">
        <rect x="10" y="0" width="380" height="60" style="fill: #fff; rx: 15; ry: 15; filter: drop-shadow(2px 2px 3px rgba(0, 0, 0, 0.1)); stroke: ${backgroundColor}; stroke-opacity: 0.7;"></rect>
        <rect x="10" y="3" width="10" height="54" style="fill: ${bandColor}; fill-opacity: 0.7; rx: 15; ry: 15;"></rect>
        <foreignObject x="30" y="10" width="340" height="40" style="overflow: hidden;">
          <body xmlns="http://www.w3.org/1999/xhtml" style="margin: 0;">
            <a href="${issue.html_url}" target="_blank" style="text-decoration: none;">
              <h3 style="font-size: 12px; font-family: Arial, sans-serif; font-weight: bold; color: #007bff; margin: 0;">${issue.title}</h3>
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

    let headerColor, subheaderColor;
    if (colorScheme === 'light') {
        headerColor = '#ffffff';
        subheaderColor = '#cccccc';
    } else { // default to dark
        headerColor = '#000000';
        subheaderColor = '#333333';
    }

    const columns = {
        now: issues.filter(issue => issue.labels.some(label => label.name === 'Roadmap: Now')),
        later: issues.filter(issue => issue.labels.some(label => label.name === 'Roadmap: Later')),
        future: issues.filter(issue => issue.labels.some(label => label.name === 'Roadmap: Future'))
    };

    const maxItemsCount = Math.max(columns.now.length, columns.later.length, columns.future.length);
    const svgHeight = 100 + (maxItemsCount * 80); // Calculate height based on the number of items

    return `
    <svg viewBox="0 0 1200 ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
      ${createColumn('Now', "Our top priority. We're probably working on it right now or starting pretty soon.", columns.now, 0, 'now', 'rgba(40, 167, 69, 0.7)', 'rgba(40, 167, 69, 0.7)', headerColor, subheaderColor)}
      ${createColumn('Later', "Our next priority. We'll work on this soon if everything goes as planned.", columns.later, 400, 'later', 'rgba(255, 193, 7, 0.7)', 'rgba(255, 193, 7, 0.7)', headerColor, subheaderColor)}
      ${createColumn('Future', "Not a priority. We're considering working on this but it's too early to know when.", columns.future, 800, 'future', 'rgba(108, 117, 125, 0.7)', 'rgba(108, 117, 125, 0.7)', headerColor, subheaderColor)}
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
