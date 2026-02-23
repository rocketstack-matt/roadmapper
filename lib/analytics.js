const https = require('https');

function trackEvent(eventName, params = {}) {
  const measurementId = process.env.GA_MEASUREMENT_ID;
  const apiSecret = process.env.GA_API_SECRET;
  if (!measurementId || !apiSecret) return;

  const payload = JSON.stringify({
    client_id: params.client_id || 'server',
    events: [{ name: eventName, params }]
  });

  const url = new URL('https://www.google-analytics.com/mp/collect');
  url.searchParams.set('measurement_id', measurementId);
  url.searchParams.set('api_secret', apiSecret);

  const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  req.on('error', () => {});
  req.write(payload);
  req.end();
}

module.exports = { trackEvent };
