// Shared reverse-proxy handler for Google tag gateway ("first-party mode").
//
// Underscore-prefixed: Cloudflare Pages does NOT turn this file into a route,
// so it is safe to import from the path handlers (e.g. functions/m7q3/[[path]].js).
//
// What it does: forwards every request under a reserved path on
// get.menonmedispa.com to the *.fps.goog origin Google issues when you enable
// the gateway in the Google tag / GTM admin. This makes the GTM/GA4 tag load
// and report from our own domain instead of googletagmanager.com, so ad/tracking
// blockers and Safari/Firefox ITP stop dropping the hits.
//
// Setup + the page snippet change are documented in CLAUDE.md ("Google tag gateway").
//
// The fps.goog origin is supplied per-path via a Pages environment variable so
// no Google-issued value is hardcoded. Until the var is set the proxy returns 503.

export function gateway(originVar) {
  return async function onRequest({ request, params, env }) {
    const origin = env[originVar];
    if (!origin) {
      return new Response(`gateway origin not configured (${originVar})`, { status: 503 });
    }

    // params.path = the URL segments after the reserved prefix.
    // Empty for the loader request itself (e.g. /m7q3/?id=GTM-XXXX).
    const segs = params.path;
    const sub = Array.isArray(segs) ? segs.join("/") : segs || "";
    const { search } = new URL(request.url);
    const upstream = `https://${origin}/${sub}${search}`;

    // Forward the request verbatim (cookies + query string preserved) but:
    //  - drop Host so fetch() sets it to the fps.goog origin (Google requires this)
    //  - attach Cloudflare's geolocation so fps.goog can geo-locate the hit
    const headers = new Headers(request.headers);
    headers.delete("host");

    const cf = request.cf || {};
    if (cf.country && cf.regionCode) {
      headers.set("X-Forwarded-CountryRegion", `${cf.country}-${cf.regionCode}`);
    } else if (cf.country) {
      headers.set("X-Forwarded-Country", cf.country);
    }
    if (cf.latitude && cf.longitude) {
      const city = cf.city ? `;city=${cf.city}` : "";
      headers.set("X-Forwarded-Geolocation", `latlong=${cf.latitude},${cf.longitude}${city}`);
    }

    const noBody = request.method === "GET" || request.method === "HEAD";
    return fetch(upstream, {
      method: request.method,
      headers,
      body: noBody ? undefined : request.body,
      redirect: "manual",
    });
  };
}
