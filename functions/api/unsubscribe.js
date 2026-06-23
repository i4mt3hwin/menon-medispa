// functions/api/unsubscribe.js — one-click + link unsubscribe for marketing emails.
// The email's footer link and List-Unsubscribe header carry ?e=<email>&t=<token>, where the token is
// HMAC-SHA256(email, RESEND_API_KEY) — so a recipient can unsubscribe themselves but not others. We
// verify the token, then mark the contact unsubscribed in the Resend audience. Handles GET (link
// click, shows a page) and POST (RFC 8058 List-Unsubscribe-Post one-click). NON-PHI.

async function unsubToken(email, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(email).toLowerCase()));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time compare so token verification does not leak via response timing.
function timingSafeEqual(a, b) {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function page(title, message, status = 200) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Menon Medispa</title></head>
<body style="margin:0;background:#f1edf0;font-family:Georgia,'Times New Roman',serif;color:#2e2a31;">
<div style="max-width:480px;margin:0 auto;padding:48px 16px;">
<div style="background:#fff;border:1px solid #e7dfe6;border-radius:14px;overflow:hidden;">
<div style="background:#564962;height:56px;"></div>
<div style="height:3px;background:#c7a468;"></div>
<div style="padding:30px 32px 34px;text-align:center;">
<h1 style="margin:0 0 12px;font-size:22px;font-weight:normal;color:#564962;">${title}</h1>
<p style="margin:0;font-size:15px;line-height:1.6;color:#43404a;">${message}</p>
<p style="margin:22px 0 0;font-size:13px;"><a href="https://www.menonmedispa.com" style="color:#564962;text-decoration:none;">menonmedispa.com</a></p>
</div></div></div></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html;charset=utf-8' } });
}

async function unsubscribeContact(email, env) {
  if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) return;
  // Resend accepts the email in the contact path; mark unsubscribed (kept, not deleted, for record).
  await fetch(`https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ unsubscribed: true }),
  }).catch(() => {});
}

async function handle({ request, env }) {
  const url = new URL(request.url);
  const email = (url.searchParams.get('e') || '').trim().toLowerCase();
  const token = url.searchParams.get('t') || '';
  const invalid = 'This unsubscribe link is invalid or expired. Please call us at (973) 494-8431 to be removed.';
  if (!email || !token || !env.RESEND_API_KEY) return page('Unsubscribe', invalid, 400);
  const expected = await unsubToken(email, env.RESEND_API_KEY);
  if (!timingSafeEqual(token, expected)) return page('Unsubscribe', invalid, 400);
  await unsubscribeContact(email, env);
  return page("You're unsubscribed", "You won't receive further marketing emails from Menon Medispa. You can rejoin anytime from our website.");
}

export const onRequestGet = handle;
export const onRequestPost = handle;
