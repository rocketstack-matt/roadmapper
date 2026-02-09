const { confirmRegistration } = require('../lib/keys');

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Extract token from query string
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    res.redirect(302, '/?confirm_error=' + encodeURIComponent('No confirmation token provided'));
    return;
  }

  const result = await confirmRegistration(token);

  if (!result.success) {
    res.redirect(302, '/?confirm_error=' + encodeURIComponent(result.reason));
    return;
  }

  // Redirect to landing page with confirmation data
  const params = new URLSearchParams({
    confirmed: 'true',
    owner: result.owner,
    repo: result.repo,
    key: result.key || '',
  });
  res.redirect(302, '/?' + params.toString());
};

module.exports = handler;
