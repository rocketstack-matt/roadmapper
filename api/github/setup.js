/**
 * Post-installation redirect handler.
 * GitHub redirects here after a user installs the GitHub App.
 * Redirects the user to the landing page with a success message.
 */
const handler = async (req, res) => {
  const host = req.headers.host || 'roadmapper.rocketstack.co';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  return res.redirect(302, `${baseUrl}/?github_app=installed`);
};

module.exports = handler;
