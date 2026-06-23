// functions/api/lead.js — lead + appointment-request intake.
// Bindings (Cloudflare Pages -> Settings): D1 database `DB`; secrets RESEND_API_KEY,
// LEAD_NOTIFY_TO, LEAD_FROM. Optional RESEND_AUDIENCE_ID (when set, consented leads are added to that
// Resend Audience). Email/audience are DEFERRED: the Function persists to D1 even when those env vars
// are unset (graceful degrade). NON-PHI store — see prompts/shared/reference/customer-data-best-practices.md.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

function esc(s) {
  return String(s || '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

// --- Email constants + builders -------------------------------------------------------------------
// Business constants, inlined because a Pages Function cannot import src/lib/site.ts. Keep in sync
// with site.ts (NAP, brand color, timezone). Logo is the live wixstatic horizontal mark, forced to
// PNG so email clients (Gmail) render it.
const SITE = {
  name: 'Menon Medispa',
  address: '45 Essex St, Suite 202, Millburn, NJ 07041',
  phone: '(973) 494-8431',
  replyTo: 'admin@menonregen.com',
  url: 'https://www.menonmedispa.com',
  logo: 'https://static.wixstatic.com/media/f61cce_8fe074e5b20c4dbf804e2b32233a140a~mv2.png/v1/fill/w_440,h_106,al_c,q_90/medispa_logo_horizontal.png',
  brand: '#564962',
  gold: '#c7a468',
  timeZone: 'America/New_York',
};

// First $-amount embedded in the service string ("$189", "$1,200", "$12/unit"); null when none.
function parsePrice(s) {
  const m = String(s || '').match(/\$[\d,]+(?:\.\d{2})?(?:\s*\/\s*[A-Za-z]+)?/);
  return m ? m[0].replace(/\s+/g, '') : null;
}

// "August 28, 2025 at 2:30 PM EDT" from an ISO date + a window label. EDT/EST is derived from the
// date itself (noon UTC of that day avoids the midnight DST edge). A non-clock window (e.g. "Morning")
// renders as "August 28, 2025 (Morning, ET)". Returns null when there is no usable date.
function formatApptWhen(date, window, tz) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T12:00:00Z`);
  if (isNaN(d.getTime())) return null;
  const dateStr = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'long', day: 'numeric', year: 'numeric' }).format(d);
  let tzAbbr = 'ET';
  try {
    const tn = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(d).find((p) => p.type === 'timeZoneName');
    if (tn && tn.value) tzAbbr = tn.value;
  } catch (_) { /* fall back to ET */ }
  const w = (window || '').trim();
  if (!w) return dateStr;
  if (/\d{1,2}:\d{2}\s*(am|pm)/i.test(w) || /^\d{1,2}\s*(am|pm)$/i.test(w)) return `${dateStr} at ${w} ${tzAbbr}`;
  return `${dateStr} (${w}, ET)`;
}

// Unsubscribe link signing. The token is an HMAC of the email keyed by RESEND_API_KEY (already
// configured for sending), so a recipient can unsubscribe themselves but cannot unsubscribe others.
// functions/api/unsubscribe.js verifies the same way and marks the contact unsubscribed in Resend.
async function unsubToken(email, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(email).toLowerCase()));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function buildUnsubUrl(email, env, origin) {
  if (!email || !env.RESEND_API_KEY) return null;
  const t = await unsubToken(email, env.RESEND_API_KEY);
  return `${origin}/api/unsubscribe?e=${encodeURIComponent(email)}&t=${t}`;
}

// Sender header. LEAD_FROM is just the mailbox (e.g. appointments@menonmedispa.com); inboxes show
// the bare local part ("appointments") as the sender name. Prepend the business display name so it
// reads "Menon Medispa". If LEAD_FROM already carries a display name (contains "<"), use it verbatim.
function fromHeader(env) {
  const f = (env.LEAD_FROM || '').trim();
  return f.includes('<') ? f : `${SITE.name} <${f}>`;
}

// Shared branded chrome for the customer emails: purple logo band + gold hairline + a centered
// footer. `disclaimer` is trusted HTML (a fixed string), rendered bold + centered when present.
// `unsubUrl` (when present) adds an Unsubscribe link to the footer (CAN-SPAM; matched by the
// List-Unsubscribe header on the send).
function emailShell(inner, disclaimer, unsubUrl) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f1edf0;">
<div style="background:#f1edf0;padding:28px 12px;font-family:Georgia,'Times New Roman',serif;color:#2e2a31;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e7dfe6;">
<tr><td style="padding:26px 32px;text-align:center;background:${SITE.brand};"><img src="${SITE.logo}" width="230" alt="${esc(SITE.name)}" style="display:inline-block;max-width:230px;height:auto;" /></td></tr>
<tr><td style="height:3px;background:${SITE.gold};font-size:0;line-height:0;">&nbsp;</td></tr>
${inner}
<tr><td style="padding:26px 32px 30px;text-align:center;"><div style="border-top:1px solid #efe9ee;padding-top:22px;">
<p style="margin:0;font-size:15px;color:${SITE.brand};letter-spacing:.06em;">${esc(SITE.name.toUpperCase())}</p>
<p style="margin:9px 0 0;font-size:13px;line-height:1.8;color:#9a92a0;">${esc(SITE.address)}<br/>${esc(SITE.phone)}<br/><a href="${SITE.url}" style="color:${SITE.brand};text-decoration:none;">menonmedispa.com</a></p>
${disclaimer ? `<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#7c7585;font-weight:bold;">${disclaimer}</p>` : ''}
${unsubUrl ? `<p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:#b3acb8;"><a href="${unsubUrl}" style="color:#9a92a0;text-decoration:underline;">Unsubscribe</a> from marketing emails</p>` : ''}
</div></td></tr>
</table></div></body></html>`;
}

// The booking-request confirmation sent to the customer (appointment requests).
function customerBookingHtml({ firstName, service, whenStr, price, name, phone, unsubUrl }) {
  const cardRow = (k, v) => `<tr><td style="padding:6px 0;color:#8a8290;width:96px;vertical-align:top;">${esc(k)}</td><td style="padding:6px 0;color:#43404a;">${esc(v)}</td></tr>`;
  let rows = '';
  if (whenStr) rows += cardRow('Date', whenStr);
  rows += cardRow('Location', SITE.address);
  if (price) rows += cardRow('Price', price);
  const detail = (k, v) => v ? `<tr><td style="padding:4px 0;color:#8a8290;width:96px;">${esc(k)}</td><td style="padding:4px 0;color:#43404a;">${esc(v)}</td></tr>` : '';
  const inner = `<tr><td style="padding:30px 32px 8px;">
<h1 style="margin:0;font-size:23px;font-weight:normal;color:${SITE.brand};">We've received your booking request</h1>
<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#43404a;">Hi ${esc(firstName)},</p>
<p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#43404a;">Thanks for your booking request. We're checking our availability and will get back to you soon. Here is what you requested:</p></td></tr>
<tr><td style="padding:18px 32px 4px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3f6;border:1px solid #ece3eb;border-radius:10px;">
<tr><td style="padding:18px 20px 6px;"><div style="font-size:16px;font-weight:bold;color:#3a3340;">${esc(service)}</div></td></tr>
<tr><td style="padding:0 20px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">${rows}</table></td></tr>
</table></td></tr>
<tr><td style="padding:16px 32px 4px;">
<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#9a92a0;margin-bottom:4px;">Client details</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">${detail('Name', name)}${detail('Contact number', phone)}</table></td></tr>`;
  return emailShell(inner, 'This is a request confirmation, not a finalized appointment.<br/>Our team will reach out to confirm your time.', unsubUrl);
}

// The lighter confirmation sent to the customer for a plain contact inquiry (no booking card).
function customerContactHtml({ firstName, unsubUrl }) {
  const inner = `<tr><td style="padding:30px 32px 22px;">
<h1 style="margin:0;font-size:23px;font-weight:normal;color:${SITE.brand};">We received your message</h1>
<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#43404a;">Hi ${esc(firstName)},</p>
<p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#43404a;">Thanks for reaching out to ${esc(SITE.name)}. We received your message and our team will be in touch shortly.</p></td></tr>`;
  return emailShell(inner, null, unsubUrl);
}

// The confirmation sent to someone who joins the email list via the website newsletter sign-up.
function customerNewsletterHtml(unsubUrl) {
  const inner = `<tr><td style="padding:30px 32px 22px;">
<h1 style="margin:0;font-size:23px;font-weight:normal;color:${SITE.brand};">You're on the list</h1>
<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#43404a;">Thanks for subscribing to ${esc(SITE.name)}. You'll get our monthly offers and skincare tips by email. You can unsubscribe anytime from any email.</p></td></tr>`;
  return emailShell(inner, null, unsubUrl);
}

// The Find Your Glow profile block for the STAFF email. `raw` is the stringified profile a booking
// carried (see leadForm.ts / find-your-glow.astro). Parsed defensively; every value is escaped. This
// is the ONLY place glow data is rendered — it is never stored in D1 or forwarded.
function glowHtml(raw) {
  let g;
  try { g = JSON.parse(String(raw).slice(0, 8000)); } catch { return ''; }
  if (!g || typeof g !== 'object') return '';
  const p = g.profile || {};
  const sub = (t) => `<div style="margin:16px 0 6px;font-size:11px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:#564962;">${esc(t)}</div>`;
  const line = (k, v) => v ? `<div style="margin:3px 0;"><span style="color:#6b7280;">${esc(k)}:</span> <span style="color:#111827;">${esc(v)}</span></div>` : '';
  const allConcerns = Array.isArray(p.concerns) ? p.concerns : [];
  const otherConcerns = allConcerns.filter((c) => c && c !== p.primary).join(', ');
  const treatments = Array.isArray(g.treatments)
    ? g.treatments.map((t) => `<li style="margin:0 0 8px;"><span style="color:#111827;font-weight:bold;">${esc(t && t.name)}</span>${t && t.match != null ? ` <span style="color:#564962;">&middot; ${esc(t.match)}% match</span>` : ''}${t && t.why ? `<div style="color:#6b7280;font-size:13px;margin-top:1px;">${esc(t.why)}</div>` : ''}</li>`).join('')
    : '';
  const steps = (arr) => Array.isArray(arr) && arr.length
    ? arr.map((s) => `<li style="margin:2px 0;">${esc(s && s.name)}${s && s.note ? ` <span style="color:#9ca3af;">(${esc(s.note)})</span>` : ''}</li>`).join('')
    : '<li style="color:#9ca3af;">none noted</li>';
  const r = g.routine || {};
  const routineCol = (label, arr) => `<div style="margin-bottom:6px;"><span style="color:#111827;font-weight:bold;font-size:13px;">${label}</span><ul style="margin:2px 0 0 18px;padding:0;font-size:13px;color:#374151;">${steps(arr)}</ul></div>`;
  return `<div style="margin-top:26px;padding-top:20px;border-top:2px solid #564962;">
<h3 style="margin:0;font-size:20px;font-weight:bold;color:#564962;text-align:center;">Skin quiz results (Find Your Glow)</h3>
<div style="font-size:12px;color:#9ca3af;font-style:italic;text-align:center;margin-top:3px;">Self-guided cosmetic skin quiz the client completed. Not a medical assessment.</div>
${sub('What the client told us')}
${line('Main concern', p.primary)}${line('Other concerns', otherConcerns)}${line('Skin type', p.skinType)}${line('Sensitivity', p.sensitivity)}${line('Pregnant / nursing', p.pregnancy ? 'Yes' : '')}
${g.safetyNote ? `<div style="margin:8px 0 0;padding:8px 12px;background:#fbf1e0;border-left:3px solid #c7a468;border-radius:4px;color:#7a5b1e;font-size:13px;line-height:1.5;"><b>Heads up:</b> ${esc(g.safetyNote)}</div>` : ''}
${sub('What the quiz recommended')}
<div style="color:#6b7280;font-size:13px;margin:0 0 4px;">Suggested treatments</div>
<ol style="margin:0 0 12px 18px;padding:0;font-size:14px;">${treatments || '<li style="color:#9ca3af;">none</li>'}</ol>
<div style="color:#6b7280;font-size:13px;margin:0 0 4px;">Suggested at-home routine</div>
${routineCol('AM', r.am)}${routineCol('PM', r.pm)}${routineCol('Weekly', r.weekly)}
</div>`;
}

// The STAFF notification: a clean, sectioned card a provider can scan top to bottom — a header that
// states the request type, the lead's name, then grouped Contact / Request blocks, then the glow
// block when present. Deliberately lean: the telemetry fields (page, UTMs, consent copy, version,
// submitted time, IP, user agent) are STILL captured + stored in D1, just not shown here.
function staffHtml(data, ctx) {
  const isAppt = ctx.type === 'appointment_request';
  const sub = (t) => `<div style="margin:18px 0 6px;font-size:11px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:#564962;">${esc(t)}</div>`;
  const line = (k, v) => v ? `<tr><td style="padding:4px 16px 4px 0;color:#6b7280;vertical-align:top;white-space:nowrap;">${esc(k)}</td><td style="padding:4px 0;color:#111827;">${esc(v)}</td></tr>` : '';
  const contact = [line('Email', ctx.email), line('Phone', ctx.phone)].join('');
  const request = [
    line('Service', data.service_interest),
    line('Preferred date', data.preferred_date),
    line('Preferred time', data.preferred_window),
    line('Message', data.message),
  ].join('');
  return `<div style="background:#f1edf0;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e7dfe6;">
<tr><td style="background:#564962;padding:16px 24px;">
<div style="color:#ffffff;font-size:17px;font-weight:bold;">${isAppt ? 'New appointment request' : 'New website inquiry'}</div>
<div style="color:#d9cfe0;font-size:12px;margin-top:2px;">${esc(SITE.name)} website lead</div></td></tr>
<tr><td style="height:3px;background:#c7a468;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:18px 24px 24px;">
<div style="font-size:20px;font-weight:bold;color:#111827;">${esc(ctx.name || 'New lead')}</div>
${sub('Contact')}
<table cellpadding="0" cellspacing="0" style="font-size:14px;">${contact || '<tr><td style="color:#9ca3af;font-size:14px;">none provided</td></tr>'}</table>
${request ? sub('Request') + `<table cellpadding="0" cellspacing="0" style="font-size:14px;">${request}</table>` : ''}
${ctx.glow ? glowHtml(ctx.glow) : ''}
</td></tr></table>
<p style="max-width:600px;margin:10px auto 0;text-align:center;font-size:11px;color:#b3acb8;">Sent by the Menon Medispa website. Reply to reach the client directly.</p>
</div>`;
}

// --- Lead manager forward (DORMANT until go-live) -------------------------------------------------
// Forwards a captured lead to the central Regtek Content Engine lead manager. This is a guaranteed
// NO-OP unless all three env vars are set (LEADS_ENGINE_URL, LEADS_INGEST_TOKEN,
// LEADS_ENGINE_CLIENT_ID), so the site ships inert and the integration is "swapped in" simply by
// setting them in Cloudflare Pages -> Settings (and back out by unsetting any one). Best effort: it
// never throws into the response path and runs via waitUntil, so lead capture never depends on the
// Engine being reachable. The lead is already persisted to this site's own D1 before this runs.
// To remove the integration entirely: delete this function and its single call site below.
function maybeForwardLead(env, waitUntil, lead) {
  if (!env.LEADS_ENGINE_URL || !env.LEADS_INGEST_TOKEN || !env.LEADS_ENGINE_CLIENT_ID) return;
  const base = String(env.LEADS_ENGINE_URL).replace(/\/+$/, '');
  const url = `${base}/api/clients/${env.LEADS_ENGINE_CLIENT_ID}/leads/ingest`;
  const p = fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-leads-token': env.LEADS_INGEST_TOKEN },
    body: JSON.stringify(lead),
  }).catch(() => {});
  if (typeof waitUntil === 'function') waitUntil(p);
}

// --- Resend audience (grow the marketing list) ----------------------------------------------------
// Adds a CONSENTED lead's email to a Resend Audience so the practice can newsletter/offer them later.
// Guaranteed NO-OP unless RESEND_API_KEY + RESEND_AUDIENCE_ID are both set. The caller only invokes
// this when the email-consent box was ticked (compliance). Best-effort via waitUntil — never blocks
// or fails the lead. Resend dedupes by email within an audience, so a repeat submit is harmless.
function maybeAddToAudience(env, waitUntil, contact) {
  if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID || !contact || !contact.email) return;
  const body = { email: contact.email, unsubscribed: false };
  if (contact.firstName) body.first_name = contact.firstName;
  if (contact.lastName) body.last_name = contact.lastName;
  const p = fetch(`https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});
  if (typeof waitUntil === 'function') waitUntil(p);
}

// Newsletter sign-up: email-only, consent implicit (subscribing IS the opt-in). Stores a minimal
// record + consent audit, adds the email to the Resend audience, and sends a light confirmation.
// No name required, no booking confirmation, no staff alert.
async function handleNewsletterSignup(env, request, waitUntil, data) {
  const email = (data.email || '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: 'bad_email' }, 422);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const ip = request.headers.get('cf-connecting-ip') || null;
  const consentText = 'Subscribed via the website newsletter sign-up ("Are you on the list?"): monthly offers and skincare tips by email.';

  // Store a minimal record + the consent audit (NON-PHI: just the email). Best-effort: even if D1 is
  // unbound or errors, still add to the audience below.
  if (env.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO leads (id, created_at, type, status, name, email, phone, service_interest, message,
           preferred_date, preferred_window, source_page, utm_source, utm_medium, utm_campaign, utm_term, utm_content, user_agent)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        id, now, 'newsletter', 'new', null, email, null, null, null, null, null,
        (data.source_page || '').slice(0, 300),
        data.utm_source || null, data.utm_medium || null, data.utm_campaign || null, data.utm_term || null, data.utm_content || null,
        (request.headers.get('user-agent') || '').slice(0, 300),
      ).run();
      await env.DB.prepare(
        `INSERT INTO consent_log (id, lead_id, channel, granted, consent_text, consent_version, ip, created_at)
         VALUES (?,?,?,?,?,?,?,?)`
      ).bind(crypto.randomUUID(), id, 'email', 1, consentText, '1', ip, now).run();
    } catch (_) { /* never block the signup on a storage hiccup */ }
  }

  // Add to the Resend audience — the whole point of the form. Consent is implicit in subscribing.
  maybeAddToAudience(env, waitUntil, { email });

  // Light "you're on the list" confirmation (best-effort; only when Resend is configured). Carries an
  // unsubscribe link + List-Unsubscribe header (the copy promises it, and it is a marketing email).
  if (env.RESEND_API_KEY && env.LEAD_FROM) {
    const unsub = await buildUnsubUrl(email, env, new URL(request.url).origin);
    const p = fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: fromHeader(env), to: email, reply_to: SITE.replyTo, subject: "You're on the list", html: customerNewsletterHtml(unsub),
        ...(unsub ? { headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}),
      }),
    }).catch(() => {});
    if (typeof waitUntil === 'function') waitUntil(p);
  }

  return json({ ok: true, id });
}

export async function onRequestPost({ request, env, waitUntil }) {
  // Parse JSON or urlencoded form posts.
  let data = {};
  const ct = request.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) data = await request.json();
    else { for (const [k, v] of (await request.formData()).entries()) data[k] = v; }
  } catch { return json({ ok: false, error: 'bad_request' }, 400); }

  // Honeypot: a hidden field bots fill. Silently accept, store nothing.
  if (data.company_website) return json({ ok: true });

  // Newsletter sign-up takes the email-only path (no name/booking required).
  if (data.type === 'newsletter') return handleNewsletterSignup(env, request, waitUntil, data);

  // Minimal validation.
  const email = (data.email || '').trim();
  const phone = (data.phone || '').trim();
  const name = (data.name || '').trim();
  if (!name || (!email && !phone)) return json({ ok: false, error: 'missing_contact' }, 422);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: 'bad_email' }, 422);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const type = data.type === 'appointment_request' ? 'appointment_request' : 'contact';
  const ip = request.headers.get('cf-connecting-ip') || null;

  // Sanitize the requested slot: store a date only if it's a well-formed ISO date,
  // else null (the front desk confirms the actual time regardless). Keeps junk out of D1.
  const preferredDate = /^\d{4}-\d{2}-\d{2}$/.test((data.preferred_date || '').trim())
    ? data.preferred_date.trim()
    : null;
  const preferredWindow = (data.preferred_window || '').toString().slice(0, 60) || null;

  // Insert the lead. (If DB binding is missing, surface a clear error.)
  if (!env.DB) return json({ ok: false, error: 'db_unbound' }, 500);
  await env.DB.prepare(
    `INSERT INTO leads (id, created_at, type, status, name, email, phone, service_interest, message,
       preferred_date, preferred_window, source_page, utm_source, utm_medium, utm_campaign, utm_term, utm_content, user_agent)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, now, type, 'new', name, email, phone,
    (data.service_interest || '').slice(0, 120), (data.message || '').slice(0, 2000),
    preferredDate, preferredWindow,
    (data.source_page || '').slice(0, 300),
    data.utm_source || null, data.utm_medium || null, data.utm_campaign || null, data.utm_term || null, data.utm_content || null,
    (request.headers.get('user-agent') || '').slice(0, 300)
  ).run();

  // Consent audit — one row per channel, recording the EXACT copy shown.
  const consents = [];
  if (data.consent_email_text) consents.push(['email', data.consent_email === 'on' || data.consent_email === 'true', data.consent_email_text]);
  if (data.consent_sms_text) consents.push(['sms', data.consent_sms === 'on' || data.consent_sms === 'true', data.consent_sms_text]);
  for (const [channel, granted, text] of consents) {
    await env.DB.prepare(
      `INSERT INTO consent_log (id, lead_id, channel, granted, consent_text, consent_version, ip, created_at)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(crypto.randomUUID(), id, channel, granted ? 1 : 0, String(text).slice(0, 500), data.consent_version || '1', ip, now).run();
  }

  // Forward the lead to the central lead manager (dormant until the LEADS_* env vars are set). The
  // lead is already in this site's D1 above, so this is best-effort and never blocks the response.
  maybeForwardLead(env, waitUntil, {
    name,
    email,
    phone,
    serviceInterest: (data.service_interest || '').slice(0, 120) || null,
    message: (data.message || '').slice(0, 2000) || null,
    // Menon's form consent is permission to be contacted about the inquiry -> follow-up consent.
    // Marketing/newsletter consent is left false (no explicit marketing opt-in on this form); the
    // operator sets it per lead in the manager before adding anyone to a marketing audience.
    consentFollowup: data.consent_email === 'on' || data.consent_email === 'true',
    consentMarketing: false,
    consentText: data.consent_email_text || null,
    sourceUrl: (data.source_page || '').slice(0, 500) || null,
    submittedAt: now,
    externalRef: id,
  });

  // Grow the Resend marketing audience with leads who TICKED the email-consent box (compliance: only
  // the consented). Dormant unless RESEND_API_KEY + RESEND_AUDIENCE_ID are set; best-effort.
  if (email && (data.consent_email === 'on' || data.consent_email === 'true')) {
    const parts = name.split(/\s+/);
    maybeAddToAudience(env, waitUntil, {
      // Lowercase to match the newsletter path and the unsubscribe lookup (which always
      // PATCHes the lowercased address), so a mixed-case email can always be unsubscribed.
      email: email.toLowerCase(),
      firstName: parts[0] || name,
      lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
    });
  }

  // --- Email via Resend. Best-effort: the lead is already persisted, so a send failure never loses
  // it. DEFERRED: nothing sends until RESEND_API_KEY + LEAD_FROM are set in Cloudflare Pages.
  if (env.RESEND_API_KEY && env.LEAD_FROM) {
    const send = (to, subject, html, replyTo, unsubUrl) => fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: fromHeader(env), to, subject, html,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(unsubUrl ? { headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}),
      }),
    }).catch(() => {});

    const firstName = name.split(/\s+/)[0] || name;

    // 1) Customer confirmation — always sent when we have an email (no opt-in gate). Booking layout
    // for an appointment request, a lighter note for a contact inquiry. Both carry an unsubscribe link
    // + List-Unsubscribe header (CAN-SPAM).
    if (email) {
      const unsub = await buildUnsubUrl(email, env, new URL(request.url).origin);
      if (type === 'appointment_request') {
        const service = (data.service_interest || '').trim();
        const html = customerBookingHtml({
          firstName,
          service: service || 'Your requested appointment',
          whenStr: formatApptWhen(preferredDate, preferredWindow, SITE.timeZone),
          price: parsePrice(service),
          name,
          phone,
          unsubUrl: unsub,
        });
        await send(email, "We've received your booking request", html, SITE.replyTo, unsub);
      } else {
        await send(email, 'We received your message', customerContactHtml({ firstName, unsubUrl: unsub }), SITE.replyTo, unsub);
      }
    }

    // 2) Staff notification — only when a recipient inbox is configured. Lean lead essentials, plus
    // the Find Your Glow profile when a booking carried one (data.glow_summary). Glow data is rendered
    // HERE ONLY: it is never written to D1 and never forwarded to the lead manager. Reply-to is the
    // customer so the front desk can reply straight to them.
    if (env.LEAD_NOTIFY_TO) {
      const staffSubject = type === 'appointment_request'
        ? `New appointment request: ${name}`
        : `New website inquiry: ${name}`;
      const html = staffHtml(data, { name, email, phone, type, glow: data.glow_summary || null });
      await send(env.LEAD_NOTIFY_TO, staffSubject, html, email || SITE.replyTo);
    }
  }

  return json({ ok: true, id });
}
