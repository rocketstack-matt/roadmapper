const https = require('https');

// GA_MEASUREMENT_ID, trimmed: a stray newline in the env value corrupts the
// Measurement Protocol request and breaks the inline gtag snippet's string
// literal (a syntax error that stops analytics loading on every page).
function measurementId() {
  return (process.env.GA_MEASUREMENT_ID || '').trim();
}

// Google Analytics snippet for the HTML pages' <head>, or '' when no
// measurement ID is configured.
function gaSnippet() {
  const gaId = measurementId();
  return gaId ? `
  <script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');</script>` : '';
}

function trackEvent(eventName, params = {}) {
  const gaId = measurementId();
  const apiSecret = process.env.GA_API_SECRET;
  if (!gaId || !apiSecret) return;

  const payload = JSON.stringify({
    client_id: params.client_id || 'server',
    events: [{ name: eventName, params }]
  });

  const url = new URL('https://www.google-analytics.com/mp/collect');
  url.searchParams.set('measurement_id', gaId);
  url.searchParams.set('api_secret', apiSecret);

  const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  req.on('error', () => {});
  req.write(payload);
  req.end();
}

module.exports = { trackEvent, gaSnippet };
