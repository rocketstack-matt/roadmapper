// Shared test helpers and mock data

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

const createMockReq = (url, headers = {}) => ({
  url,
  headers: { host: 'localhost:5002', ...headers },
});

const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    redirectUrl: null,
    redirectStatus: null,
    setHeader(name, value) {
      res.headers[name] = value;
      return res;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      return res;
    },
    redirect(status, url) {
      res.redirectStatus = status;
      res.redirectUrl = url;
      return res;
    },
  };
  return res;
};

module.exports = {
  createMockIssue,
  mockIssues,
  createMockReq,
  createMockRes,
};
