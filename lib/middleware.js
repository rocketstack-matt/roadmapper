const { verifyRepo } = require('./verify');
const { checkRepoRateLimit, checkIpRateLimit } = require('./ratelimit');
const { getCacheTtl } = require('./tiers');

/**
 * Extract owner and repo from the URL path.
 * Handles patterns like:
 *   /:owner/:repo/:bgColor/:textColor
 *   /view/:owner/:repo/:bgColor/:textColor
 *   /embed/:owner/:repo/:bgColor/:textColor
 *   /html/:owner/:repo/:bgColor/:textColor
 */
const extractOwnerRepo = (url) => {
  // Strip query string
  const path = url.split('?')[0];

  // Try prefixed routes first (view, embed, html)
  let match = path.match(/^\/(view|embed|html)\/([^/?]+)\/([^/?]+)/);
  if (match) {
    return { owner: match[2], repo: match[3] };
  }

  // Try root route (roadmap SVG)
  match = path.match(/^\/([^/?]+)\/([^/?]+)/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }

  return null;
};

/**
 * Get client IP from request headers (Vercel/proxy-aware).
 */
const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
};

/**
 * Generate an error SVG for unregistered or rate-limited repos.
 */
const errorSvg = (title, message) => {
  return `<svg viewBox="0 0 1140 200" xmlns="http://www.w3.org/2000/svg" style="background-color: #fff3cd;">
  <text x="570" y="70" style="font-size: 22px; text-anchor: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-weight: 600; fill: #856404;">${title}</text>
  <text x="570" y="110" style="font-size: 15px; text-anchor: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; fill: #856404;">${message}</text>
  <text x="570" y="150" style="font-size: 14px; text-anchor: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; fill: #856404;">Get started at roadmapper.rocketstack.co</text>
</svg>`;
};

/**
 * Generate an error HTML page for unregistered or rate-limited repos.
 */
const errorHtml = (title, message) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f6f8fa; color: #24292f; }
    .container { text-align: center; max-width: 500px; padding: 40px; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { color: #57606a; line-height: 1.6; }
    a { color: #0969da; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <p>${message}</p>
    <p><a href="https://roadmapper.rocketstack.co">Get started at roadmapper.rocketstack.co</a></p>
  </div>
</body>
</html>`;
};

/**
 * Determine if the request is for an SVG endpoint (vs HTML endpoint).
 */
const isSvgEndpoint = (url) => {
  const path = url.split('?')[0];
  return !path.startsWith('/view/') && !path.startsWith('/embed/') && !path.startsWith('/html/');
};

/**
 * Send an error response in the appropriate format (SVG or HTML).
 */
const sendError = (req, res, statusCode, title, message) => {
  if (isSvgEndpoint(req.url)) {
    res.status(statusCode);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(errorSvg(title, message));
  } else {
    res.status(statusCode);
    res.setHeader('Content-Type', 'text/html');
    res.send(errorHtml(title, message));
  }
};

/**
 * Wrap a handler with authentication and rate limiting.
 *
 * Options:
 *   skipAll: true        — skip all middleware (for landing page)
 *   ipRateLimitOnly: true — only check IP rate limit (for register endpoint)
 */
// Check if Redis is configured at runtime (not module load time, for testability)
const isRedisConfigured = () => !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

const withMiddleware = (handler, options = {}) => {
  return async (req, res) => {
    // Skip all middleware if explicitly requested or Redis not configured
    if (options.skipAll || !isRedisConfigured()) {
      return handler(req, res);
    }

    // IP-based abuse backstop
    const clientIp = getClientIp(req);
    const ipResult = await checkIpRateLimit(clientIp);
    if (!ipResult.success) {
      return sendError(req, res, 429, 'Rate limit exceeded', 'Too many requests. Please try again later.');
    }

    if (options.ipRateLimitOnly) {
      return handler(req, res);
    }

    // Extract owner/repo from URL
    const ownerRepo = extractOwnerRepo(req.url);
    if (!ownerRepo) {
      return handler(req, res);
    }

    const { owner, repo } = ownerRepo;

    // Verify repo has a valid .roadmapper key
    const verification = await verifyRepo(owner, repo);
    if (!verification.verified) {
      return sendError(req, res, 403, 'Roadmap not registered', verification.reason);
    }

    // Per-repo rate limit
    const repoResult = await checkRepoRateLimit(owner, repo, verification.tier);
    res.setHeader('X-RateLimit-Limit', repoResult.limit);
    res.setHeader('X-RateLimit-Remaining', repoResult.remaining);
    res.setHeader('X-RateLimit-Reset', repoResult.reset);

    if (!repoResult.success) {
      return sendError(req, res, 429, 'Rate limit exceeded', 'This roadmap has exceeded its rate limit. Please try again later.');
    }

    // Attach tier info to request
    req.tier = verification.tier;
    req.cacheTtl = getCacheTtl(verification.tier);

    return handler(req, res);
  };
};

module.exports = { withMiddleware, extractOwnerRepo, getClientIp, errorSvg, errorHtml, isSvgEndpoint };
