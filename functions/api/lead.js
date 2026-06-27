// functions/api/lead.js — lead + appointment-request intake.
// Bindings (Cloudflare Pages -> Settings): D1 database `DB`; secrets RESEND_API_KEY,
// LEAD_NOTIFY_TO, LEAD_FROM. Optional RESEND_AUDIENCE_ID (when set, consented leads are added to that
// Resend Audience). Email/audience are DEFERRED: the Function persists to D1 even when those env vars
// are unset (graceful degrade). NON-PHI store — see prompts/shared/reference/customer-data-best-practices.md.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

// CORS — the ad landing pages (get.menonmedispa.com, a separate Pages project) POST their lead forms
// here cross-origin. Allow only those known origins; everything else gets no CORS header (and the
// browser blocks it). Same-origin posts from www are unaffected (no Origin header to match).
const ALLOWED_ORIGINS = new Set([
  'https://get.menonmedispa.com',
  'https://menon-medispa-lp.pages.dev',
]);
function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  if (!ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Vary': 'Origin',
  };
}
// Preflight for the cross-origin landing-page posts.
export function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

function esc(s) {
  return String(s || '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

// --- Email constants + builders -------------------------------------------------------------------
// Business constants, inlined because a Pages Function cannot import src/lib/site.ts. Keep in sync
// with site.ts (NAP, brand color, timezone). Logo = the self-hosted WHITE HORIZONTAL wordmark
// (500x130, ~16KB) — small + correctly shaped for an email header, shows on the purple band.
// (Do NOT use /media/wix/f61cce_...png here: it's the 5392x5488 / ~1.2MB square mark, which loads
// slowly and renders as a giant square in the header.)
const SITE = {
  name: 'Menon Medispa',
  address: '45 Essex St, Suite 202, Millburn, NJ 07041',
  phone: '(973) 494-8431',
  replyTo: 'admin@menonregen.com',
  url: 'https://www.menonmedispa.com',
  logo: 'https://www.menonmedispa.com/images/medispa-logo-horizontal.png',
  brand: '#564962',
  gold: '#c7a468',
  timeZone: 'America/New_York',
};

// --- Spam content filter --------------------------------------------------------------------------
// The forms get human-written B2B solicitations (SEO / web-design / marketing pitches), which real
// patient inquiries never resemble. We CLASSIFY each submission, never reject it: a flagged lead is
// always still written to D1 (so a false positive is recoverable + the rules are tunable on real data).
//   - 'spam'   (Tier 1): a high-confidence jargon phrase. Stored status='spam', everything suppressed
//                        (no emails, no side-effects). Effectively zero false positives.
//   - 'review' (Tier 2): a fuzzier match. Stored status='spam_review'; the staff email STILL goes out
//                        (subject prefixed "[Possible spam] " so a Gmail filter can archive it) and the
//                        customer still gets their confirmation, but the lead is kept off all
//                        marketing/attribution pipelines until a human confirms.
//   - 'clean'          : normal flow.
// THIS IS THE SINGLE EDIT POINT — add a term to the right list to tighten. Promote a recurring Tier-2
// phrase up to SPAM_HARD to make it silent. All entries are lowercase substrings.
const SPAM_HARD = [
  'link building', 'guest post', 'backlink', 'domain authority', 'search engine optimization',
  'seo service', 'seo expert', 'seo audit', 'seo opportunit', 'seo proposal', 'organic traffic',
  'lead generation', 'rank your website', 'rank higher on google', 'first page of google',
  'improve your google ranking', 'increase your website traffic', 'website redesign',
  'web development service', 'web development company', 'mobile app development', 'crypto', 'bitcoin', 'forex',
];
const SPAM_SOFT = [
  'seo', 'ranking', 'rankings', 'web design', 'web designer', 'digital marketing', 'marketing service',
  'social media marketing', 'more leads', 'more customers', 'more traffic', 'google ranking',
  'affordable price', 'free quote', 'no obligation', 'proposal', 'outreach', 'wordpress', 'shopify',
  'i came across your website', 'i visited your website', 'reviewed your website',
];
// Explicit link only (not bare domains / email addresses) — see classifySubmission: a link alone never
// flags; it only counts when it co-occurs with a soft keyword.
const LINK_RE = /(?:https?:\/\/|www\.)\S+/i;

function classifySubmission(data) {
  const hay = [data.message, data.service_interest, data.name]
    .map((s) => String(s || '').toLowerCase())
    .join(' \n ');
  if (!hay.trim()) return 'clean';
  if (SPAM_HARD.some((k) => hay.includes(k))) return 'spam';
  const softHits = SPAM_SOFT.reduce((n, k) => (hay.includes(k) ? n + 1 : n), 0);
  const linkInMessage = LINK_RE.test(String(data.message || ''));
  if ((linkInMessage && softHits >= 1) || softHits >= 2) return 'review';
  return 'clean';
}

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

// Unsubscribe link signing. The token is an HMAC of the email keyed by UNSUB_SIGNING_KEY (falling
// back to RESEND_API_KEY when unset), so a recipient can unsubscribe themselves but cannot unsubscribe
// others. functions/api/unsubscribe.js verifies the same way and marks the contact unsubscribed in Resend.
async function unsubToken(email, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(email).toLowerCase()));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function buildUnsubUrl(email, env, origin) {
  // Sign with a dedicated key when set, else fall back to RESEND_API_KEY so existing tokens stay valid.
  // Decoupling means rotating the Resend key no longer invalidates outstanding unsubscribe links.
  const secret = env.UNSUB_SIGNING_KEY || env.RESEND_API_KEY;
  if (!email || !secret) return null;
  const t = await unsubToken(email, secret);
  return `${origin}/api/unsubscribe?e=${encodeURIComponent(email)}&t=${t}`;
}

// Sender header. LEAD_FROM is just the mailbox (e.g. appointments@menonmedispa.com); inboxes show
// the bare local part ("appointments") as the sender name. Prepend the business display name so it
// reads "Menon Medispa". If LEAD_FROM already carries a display name (contains "<"), use it verbatim.
function fromHeader(env) {
  const f = (env.LEAD_FROM || '').trim();
  return f.includes('<') ? f : `${SITE.name} <${f}>`;
}

// Newsletter ("You're on the list") sends from the MARKETING subdomain (news.menonmedispa.com — the
// same domain the broadcasts go out from), NOT the transactional appointments@ address. This keeps
// marketing mail off the booking address so a marketing complaint/bounce can't hurt the deliverability
// of appointment confirmations people actually need. Display name stays the brand. Override via the
// NEWSLETTER_FROM env var if the mailbox should differ.
function newsletterFrom(env) {
  return (env.NEWSLETTER_FROM || '').trim() || `${SITE.name} <hello@news.menonmedispa.com>`;
}

// Shared branded chrome for the customer emails: purple logo band + gold hairline + a centered
// footer. `disclaimer` is trusted HTML (a fixed string), rendered bold + centered when present.
// `unsubUrl` (when present) adds an Unsubscribe link to the footer (CAN-SPAM; matched by the
// List-Unsubscribe header on the send).
function emailShell(inner, disclaimer, unsubUrl, preheader) {
  // Hidden preview text (the snippet inboxes show next to the subject). Sits before the visible
  // content; the trailing zero-width chars stop the client from pulling footer text into the preview.
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f1edf0;">${esc(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>`
    : '';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f1edf0;">${pre}
<div style="background:#f1edf0;padding:28px 12px;font-family:Georgia,'Times New Roman',serif;color:#2e2a31;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e7dfe6;">
<tr><td style="padding:22px 32px;text-align:center;background:${SITE.brand};"><img src="${SITE.logo}" width="190" alt="${esc(SITE.name)}" style="display:inline-block;width:190px;max-width:100%;height:auto;" /></td></tr>
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
// Exported (with the other customer/staff builders) so scripts/preview-emails.mjs renders the EXACT
// production templates — previews can never drift from what actually sends.
export function customerBookingHtml({ firstName, service, whenStr, price, name, phone, unsubUrl }) {
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
export function customerContactHtml({ firstName, unsubUrl }) {
  const inner = `<tr><td style="padding:30px 32px 22px;">
<h1 style="margin:0;font-size:23px;font-weight:normal;color:${SITE.brand};">We received your message</h1>
<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#43404a;">Hi ${esc(firstName)},</p>
<p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#43404a;">Thanks for reaching out to ${esc(SITE.name)}. We received your message and our team will be in touch shortly.</p></td></tr>`;
  return emailShell(inner, null, unsubUrl);
}

// The confirmation sent to someone who joins the email list via the website newsletter sign-up.
export function customerNewsletterHtml(unsubUrl) {
  const inner = `<tr><td style="padding:30px 32px 22px;">
<h1 style="margin:0;font-size:23px;font-weight:normal;color:${SITE.brand};">You're on the list</h1>
<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#43404a;">Thanks for subscribing to ${esc(SITE.name)}. You'll get our monthly offers and skincare tips by email. You can unsubscribe anytime from any email.</p></td></tr>`;
  return emailShell(inner, null, unsubUrl);
}

// The "Welcome to Menon Medispa" email — a richer SECOND touch, scheduled ~24h after a booking/inquiry
// or ~48h after a newsletter sign-up (see maybeScheduleWelcome). Marketing/relationship mail, so it
// carries the unsubscribe link + List-Unsubscribe header and goes out from the news subdomain. Evergreen
// BY DESIGN: it LINKS to the live /sale page rather than embedding offer prices, so a send scheduled a
// day or two out can never show a stale special. Trailing slashes match astro `trailingSlash: 'always'`.
// UTM-tag an email CTA so a booking can be attributed back to this email. medium=email (GA4 files it
// under the Email channel); source/campaign stay constant across the send, only `content` varies per
// link. Marketing/relationship mail only — never tag the transactional booking/contact confirmations.
function withUtm(path, content) {
  return `${SITE.url}${path}?utm_source=welcome&utm_medium=email&utm_campaign=welcome_evergreen&utm_content=${content}`;
}

export function customerWelcomeHtml({ firstName, unsubUrl }) {
  const tel = `tel:${SITE.phone.replace(/[^\d+]/g, '')}`;
  const book = withUtm('/request-appointment/', 'book_button');
  const sale = withUtm('/sale/', 'sale_button');
  const glow = withUtm('/find-your-glow/', 'glow_button');
  const p = 'margin:14px 0 0;font-size:15px;line-height:1.65;color:#43404a;';
  const link = `color:${SITE.brand};text-decoration:underline;`;
  const inner = `<tr><td style="padding:30px 32px 4px;">
<h1 style="margin:0;font-size:23px;font-weight:normal;color:${SITE.brand};">Welcome to ${esc(SITE.name)}</h1>
<div style="text-align:center;margin:18px 0 2px;"><img src="${SITE.url}/email/dr-menon.jpg" width="340" alt="Dr. Aditi Menon, MD, founder of ${esc(SITE.name)}" style="display:inline-block;width:340px;max-width:86%;height:auto;border-radius:14px;" /></div>
<p style="${p}">Hi ${esc(firstName)},</p>
<p style="${p}">Really glad you found us. I am Dr. Aditi Menon, and ${esc(SITE.name)} is my medical spa in Millburn, NJ. We do aesthetic skin and body treatments, from Botox and facials to laser and IV therapy, in a space that is calm and judgment-free.</p>
<p style="${p}">Here is how we like to work. We start by listening, figure out what actually fits you, and never push. No jargon, no hard sell. If you are not sure where to begin, that is exactly what a first visit is for.</p>
<p style="${p}">Whenever you are ready, the easiest next step is a quick consultation. We will talk through your goals with zero pressure to book anything that day.</p></td></tr>
<tr><td style="padding:18px 32px 2px;">
<a href="${book}" style="display:block;background:${SITE.brand};color:#ffffff;text-decoration:none;text-align:center;padding:14px 18px;border-radius:9px;font-size:16px;font-family:Georgia,'Times New Roman',serif;">Book a consultation</a></td></tr>
<tr><td style="padding:10px 32px 6px;text-align:center;">
<p style="margin:0;font-size:13px;color:#8a8290;">Not ready to book? Two easy ways to start</p>
<p style="margin:8px 0 0;font-size:15px;line-height:1.7;"><a href="${sale}" style="${link}">See this month's specials</a> &nbsp;&middot;&nbsp; <a href="${glow}" style="${link}">Take the 2-minute skin quiz</a></p></td></tr>
<tr><td style="padding:14px 32px 24px;">
<p style="${p}">Prefer to talk first? Call or text us at <a href="${tel}" style="color:${SITE.brand};text-decoration:none;">${esc(SITE.phone)}</a>, or just reply to this email.</p>
<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#43404a;">Talk soon,<br/>Dr. Aditi Menon, MD<br/>${esc(SITE.name)}, Millburn NJ</p></td></tr>`;
  return emailShell(inner, null, unsubUrl, 'A calm, judgment-free place for your skin. Here is where to begin.');
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
export function staffHtml(data, ctx) {
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
  const base = { email: contact.email, unsubscribed: false };
  if (contact.firstName) base.first_name = contact.firstName;
  if (contact.lastName) base.last_name = contact.lastName;
  const url = `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`;
  const headers = { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' };
  const post = (b) => fetch(url, { method: 'POST', headers, body: JSON.stringify(b) });
  // Tag with custom properties (source/interest/signup_page/utm_*) so the practice can later build
  // specific Resend Segments. Those properties must be PRE-DEFINED in Resend (POST /contact-properties)
  // — an unknown property 422s the whole add — so we self-heal: on a 422 we retry WITHOUT properties.
  // The contact is therefore ALWAYS added; the tags are strictly best-effort and can never lose a lead.
  const props = contact.properties && Object.keys(contact.properties).length ? contact.properties : null;
  const p = (async () => {
    try {
      if (props) {
        const res = await post({ ...base, properties: props });
        if (res && res.status === 422) await post(base);
      } else {
        await post(base);
      }
    } catch { /* best-effort; never block the lead */ }
  })();
  if (typeof waitUntil === 'function') waitUntil(p);
}

// --- WhatConverts lead push (DORMANT until creds set) ---------------------------------------------
// Website FORM leads do NOT reach WhatConverts on their own: the WhatConverts script (loaded via GTM)
// auto-tracks CALLS, but its form auto-capture does not fire on these AJAX forms (preventDefault +
// fetch + redirect = no real submission for it to see). So we create the lead server-side via the
// WhatConverts Leads API -- it cannot be missed by ad-blockers or a fast redirect.
// ATTRIBUTION (so a form lead ties to the Google Ads click exactly like a call does, and WhatConverts
// can report it back to Google Ads as a CPC conversion): the page sends the gclid in the POST body
// (captured first-touch from the ad-click URL). That body value is preferred because it is the ONLY
// source that survives the CROSS-ORIGIN hop from the ad landing pages (get.menonmedispa.com) -- their
// first-party cookies never reach this origin. For same-origin www posts we also fall back to Google's
// `_gcl_aw` cookie ("GCL.<ts>.<gclid>"). We also forward `wc_client_current` (WhatConverts' own session
// cookie, same-origin only) + UTMs / landing URL / IP, and gbraid/wbraid (Google's privacy-safe click
// ids used for some iOS traffic).
// Guaranteed NO-OP unless WHATCONVERTS_API_TOKEN + WHATCONVERTS_API_SECRET are set (so this ships inert
// and is "switched on" by adding the secrets in Cloudflare Pages). Best-effort via waitUntil; the lead
// is already in D1, so this can never block or fail the response. PHI posture: structured fields only
// (name / email / phone + the cosmetic service interest) -- the free-text message is NOT forwarded.
function readCookie(cookieHeader, name) {
  const m = String(cookieHeader || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : null;
}

function maybeSendToWhatConverts(env, request, waitUntil, lead) {
  if (!env.WHATCONVERTS_API_TOKEN || !env.WHATCONVERTS_API_SECRET) return;
  const cookieHeader = request.headers.get('cookie') || '';

  // Prefer the gclid the page sent in the body (works cross-origin); fall back to Google's _gcl_aw
  // cookie ("GCL.<ts>.<gclid>", everything after the 2nd dot) for same-origin www posts.
  const clip = (v) => (v ? String(v).slice(0, 255) : null);
  const gclAw = readCookie(cookieHeader, '_gcl_aw');
  const cookieGclid = gclAw ? (gclAw.split('.').slice(2).join('.') || null) : null;
  const gclid = clip(lead.gclid) || cookieGclid;
  const gbraid = clip(lead.gbraid);
  const wbraid = clip(lead.wbraid);
  const wcClient = readCookie(cookieHeader, 'wc_client_current');

  const origin = new URL(request.url).origin;
  const sp = lead.sourcePage || '';
  const leadUrl = sp ? (sp.startsWith('http') ? sp : origin + (sp.startsWith('/') ? sp : '/' + sp)) : origin;
  const u = lead.utms || {};

  // WhatConverts' v1 API takes FORM-ENCODED params (note the additional_fields[...] bracket syntax in
  // their docs), NOT a JSON body -- a JSON body is ignored and 400s ("Invalid lead_type parameter").
  const form = new URLSearchParams();
  form.set('profile_id', String(env.WHATCONVERTS_PROFILE_ID || '159358'));
  form.set('lead_type', 'web_form');
  form.set('send_notification', 'false'); // the front desk already gets the Resend staff email
  if (lead.name) form.set('contact_name', lead.name);
  if (lead.email) form.set('email_address', lead.email);
  if (lead.phone) form.set('phone_number', lead.phone);
  form.set('lead_url', leadUrl);
  form.set('landing_url', leadUrl);
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) form.set('ip_address', ip);
  if (gclid) form.set('gclid', gclid);
  if (gbraid) form.set('additional_fields[gbraid]', gbraid);
  if (wbraid) form.set('additional_fields[wbraid]', wbraid);
  // Source attribution: WhatConverts displays whatever lead_source/lead_medium we send here — the gclid
  // field only links the Google Ads conversion, it does NOT set the dashboard source (a lead with only a
  // gclid and no source shows as "direct"). So when any Google Ads click id is present, explicitly label
  // the lead google / cpc (= Paid Search, exactly how WhatConverts tags a real auto-tagged ad click),
  // overriding any stale first-touch UTM such as utm_source=welcome. No click id -> pass the captured
  // UTMs through as before. The campaign name is left for WhatConverts to fill from the matched gclid.
  const hasClickId = !!(gclid || gbraid || wbraid);
  if (hasClickId) {
    form.set('lead_source', 'google');
    form.set('lead_medium', 'cpc');
  } else {
    if (u.source) form.set('lead_source', u.source);
    if (u.medium) form.set('lead_medium', u.medium);
    if (u.campaign) form.set('lead_campaign', u.campaign);
    if (u.content) form.set('lead_content', u.content);
    if (u.term) form.set('lead_keyword', u.term);
  }
  form.set('additional_fields[form_type]', lead.type || 'lead');
  if (lead.serviceInterest) form.set('additional_fields[service_interest]', lead.serviceInterest);
  if (lead.preferredDate) form.set('additional_fields[requested_date]', lead.preferredDate);
  if (lead.preferredWindow) form.set('additional_fields[requested_time]', lead.preferredWindow);

  const headers = {
    Authorization: 'Basic ' + btoa(`${env.WHATCONVERTS_API_TOKEN}:${env.WHATCONVERTS_API_SECRET}`),
    'content-type': 'application/x-www-form-urlencoded',
  };
  // Forward WhatConverts' own session cookie so their API can also auto-stitch the lead onto the
  // tracked visit (belt-and-suspenders alongside the explicit gclid above).
  if (wcClient) headers.Cookie = `wc_client_current=${wcClient}`;

  const p = fetch('https://app.whatconverts.com/api/v1/leads', { method: 'POST', headers, body: form.toString() })
    .then(async (r) => {
      if (r && r.ok) return; // success: log nothing (keeps lead PII out of logs)
      try { const t = await r.text(); console.warn('WhatConverts lead push failed', r.status, t.slice(0, 300)); } catch (_) {}
    })
    .catch((e) => { try { console.warn('WhatConverts lead push error:', String((e && e.message) || e).slice(0, 200)); } catch (_) {} });
  if (typeof waitUntil === 'function') waitUntil(p);
}

// --- "Welcome to Menon Medispa" scheduled email (build now, ships INERT) --------------------------
// A richer SECOND touch, scheduled via Resend's `scheduled_at` to land ~48h after the first touch
// (booking, inquiry, or newsletter). Sent ONCE per email address EVER (welcome_log dedup), regardless of
// whether the lead is converted in the meantime. Guaranteed NO-OP unless WELCOME_ENABLED === 'true'
// (so this can deploy and be previewed before it ever sends) AND RESEND_API_KEY + DB are bound.
// Marketing/relationship mail: sent from the news subdomain (protects appointments@ deliverability),
// always carrying an unsubscribe link + List-Unsubscribe header. Best-effort via waitUntil — a failed
// schedule is silently dropped (the lead is already persisted; a missed welcome is acceptable).
async function maybeScheduleWelcome(env, waitUntil, { email, firstName, origin, delayHours, channel }) {
  if (env.WELCOME_ENABLED !== 'true' || !env.RESEND_API_KEY || !env.DB) return;
  const addr = String(email || '').trim().toLowerCase();
  if (!addr) return; // welcome is email-only (phone-only leads get none)

  // Honor opt-outs: never schedule a NEW welcome for an address that has unsubscribed from marketing
  // (email_suppression is written by functions/api/unsubscribe.js). We MUST gate this ourselves —
  // Resend's audience "unsubscribed" flag only suppresses Broadcasts, not the single scheduled send the
  // welcome uses. If the lookup itself errors (e.g. table not migrated), fall through rather than block
  // every welcome on a transient hiccup.
  try {
    const sup = await env.DB.prepare('SELECT 1 FROM email_suppression WHERE email = ? LIMIT 1').bind(addr).first();
    if (sup) return;
  } catch { /* table missing / transient: proceed best-effort */ }

  // Dedup: claim the email in welcome_log. INSERT OR IGNORE makes meta.changes === 1 ONLY the first
  // time this address is ever seen (across booking, contact, and newsletter) — that is the single
  // signal that we should schedule. If the claim can't be made (e.g. the table isn't migrated yet),
  // bail rather than risk welcoming someone twice. NOTE: mark-then-send means a rare Resend failure
  // after a successful claim yields no welcome for that person; that trade is intentional (no dupes).
  let fresh = false;
  try {
    const res = await env.DB.prepare(
      `INSERT OR IGNORE INTO welcome_log (email, first_seen_at, channel) VALUES (?,?,?)`
    ).bind(addr, new Date().toISOString(), channel || null).run();
    fresh = !!(res && res.meta && res.meta.changes);
  } catch { return; }
  if (!fresh) return;

  // Best-effort send, fully guarded: the lead is already persisted and the instant confirmation already
  // sent, and this helper is awaited in the response path, so NOTHING here may throw into that path. A
  // missed welcome is acceptable (and the row stays claimed, preserving the once-ever guarantee).
  try {
    // `scheduled_at` is an absolute ISO 8601 instant (unambiguous on the Resend REST API).
    const scheduledAt = new Date(Date.now() + delayHours * 3600 * 1000).toISOString();
    const unsub = await buildUnsubUrl(addr, env, origin);
    // Send, then persist the Resend id so an in-window unsubscribe (functions/api/unsubscribe.js) can
    // CANCEL this queued welcome before it fires.
    const p = (async () => {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            from: newsletterFrom(env),
            to: addr,
            reply_to: SITE.replyTo,
            subject: 'So glad you found us. Welcome to Menon Medispa.',
            html: customerWelcomeHtml({ firstName: firstName || 'there', unsubUrl: unsub }),
            scheduled_at: scheduledAt,
            ...(unsub ? { headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}),
          }),
        });
        if (!res || !res.ok) return;
        const data = await res.json().catch(() => null);
        if (data && data.id) {
          await env.DB.prepare('UPDATE welcome_log SET scheduled_email_id = ? WHERE email = ?').bind(data.id, addr).run();
        }
      } catch { /* best-effort: a missed welcome is acceptable */ }
    })();
    if (typeof waitUntil === 'function') waitUntil(p);
  } catch { /* best-effort: never disturb the response path */ }
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
  const properties = { source: 'newsletter' };
  if (data.source_page) properties.signup_page = String(data.source_page).slice(0, 100);
  if (data.utm_source) properties.utm_source = String(data.utm_source).slice(0, 60);
  if (data.utm_campaign) properties.utm_campaign = String(data.utm_campaign).slice(0, 60);
  maybeAddToAudience(env, waitUntil, { email, properties });

  // Light "you're on the list" confirmation (best-effort; only when Resend is configured). Carries an
  // unsubscribe link + List-Unsubscribe header (the copy promises it, and it is a marketing email).
  if (env.RESEND_API_KEY && env.LEAD_FROM) {
    const unsub = await buildUnsubUrl(email, env, new URL(request.url).origin);
    const p = fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: newsletterFrom(env), to: email, reply_to: SITE.replyTo, subject: "You're on the list", html: customerNewsletterHtml(unsub),
        ...(unsub ? { headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}),
      }),
    }).catch(() => {});
    if (typeof waitUntil === 'function') waitUntil(p);
  }

  // One-time "Welcome to Menon Medispa" email (~48h out, AFTER the instant "You're on the list"
  // note so it doesn't crowd it). Deduped per email; inert unless WELCOME_ENABLED is set.
  await maybeScheduleWelcome(env, waitUntil, {
    email,
    firstName: 'there',
    origin: new URL(request.url).origin,
    delayHours: 48,
    channel: 'newsletter',
  });

  return json({ ok: true, id });
}

// Thin wrapper: run the lead handler, then stamp CORS headers onto its response when the request came
// from an allowed landing-page origin (no-op for same-origin www posts).
export async function onRequestPost(context) {
  const res = await handleLeadPost(context);
  const ch = corsHeaders(context.request);
  if (!Object.keys(ch).length) return res;
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(ch)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function handleLeadPost({ request, env, waitUntil }) {
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

  // Spam classification (see classifySubmission). The row is ALWAYS stored — only the notifications +
  // side-effects below are gated on the verdict, so a flagged lead is never lost.
  const verdict = classifySubmission(data);
  const status = verdict === 'spam' ? 'spam' : verdict === 'review' ? 'spam_review' : 'new';
  const clean = verdict === 'clean';

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
       preferred_date, preferred_window, source_page, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
       gclid, gbraid, wbraid, user_agent)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, now, type, status, name, email, phone,
    (data.service_interest || '').slice(0, 120), (data.message || '').slice(0, 2000),
    preferredDate, preferredWindow,
    (data.source_page || '').slice(0, 300),
    data.utm_source || null, data.utm_medium || null, data.utm_campaign || null, data.utm_term || null, data.utm_content || null,
    (data.gclid || '').slice(0, 512) || null, (data.gbraid || '').slice(0, 512) || null, (data.wbraid || '').slice(0, 512) || null,
    (request.headers.get('user-agent') || '').slice(0, 300)
  ).run();

  // Tier 1 (definite spam): the row is stored as status='spam' above; suppress EVERYTHING else (no
  // emails, no side-effects). The sender still gets a normal success so they don't adapt and retry.
  if (verdict === 'spam') return json({ ok: true, id });

  // From here down, the marketing/attribution/CRM side-effects + the consent audit run for CLEAN leads
  // only (gated on `clean`). A Tier-2 'review' lead is recorded (status='spam_review') and still gets
  // the tagged staff email + customer confirmation below, but is kept OFF these pipelines until a human
  // confirms it.
  // Consent audit — one row per channel, recording the EXACT copy shown.
  const consents = [];
  if (data.consent_email_text) consents.push(['email', data.consent_email === 'on' || data.consent_email === 'true', data.consent_email_text]);
  if (data.consent_sms_text) consents.push(['sms', data.consent_sms === 'on' || data.consent_sms === 'true', data.consent_sms_text]);
  if (clean) for (const [channel, granted, text] of consents) {
    await env.DB.prepare(
      `INSERT INTO consent_log (id, lead_id, channel, granted, consent_text, consent_version, ip, created_at)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(crypto.randomUUID(), id, channel, granted ? 1 : 0, String(text).slice(0, 500), data.consent_version || '1', ip, now).run();
  }

  // Forward the lead to the central lead manager (dormant until the LEADS_* env vars are set). The
  // lead is already in this site's D1 above, so this is best-effort and never blocks the response.
  if (clean) maybeForwardLead(env, waitUntil, {
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

  // Push the form lead to WhatConverts (calls already track via the WhatConverts script; this closes
  // the FORM gap so form leads are attributed to the ad click and appear alongside calls). Dormant
  // until WHATCONVERTS_API_TOKEN + WHATCONVERTS_API_SECRET are set; best-effort, never blocks.
  if (clean) maybeSendToWhatConverts(env, request, waitUntil, {
    name, email, phone, type,
    serviceInterest: (data.service_interest || '').slice(0, 120) || null,
    preferredDate, preferredWindow,
    sourcePage: data.source_page || null,
    // Google Ads click ids the page captured first-touch (the cross-origin landing pages can only
    // attribute via these — their cookies never reach this origin).
    gclid: data.gclid || null,
    gbraid: data.gbraid || null,
    wbraid: data.wbraid || null,
    utms: {
      source: data.utm_source, medium: data.utm_medium, campaign: data.utm_campaign,
      content: data.utm_content, term: data.utm_term,
    },
  });

  // Grow the Resend marketing audience with BOOKING leads who TICKED the email-consent box (compliance:
  // only the consented). Contact-form inquiries are EXCLUDED — a "Contact us" message is not a marketing
  // opt-in, so contacts never go on the subscriber list. Dormant unless RESEND_API_KEY + RESEND_AUDIENCE_ID
  // are set; best-effort.
  if (clean && type === 'appointment_request' && email && (data.consent_email === 'on' || data.consent_email === 'true')) {
    const parts = name.split(/\s+/);
    // Segmentation tags (best-effort; see maybeAddToAudience). `interest` = the cosmetic service the
    // visitor asked about — marketing data, consistent with the NON-PHI posture (glow quiz data is
    // deliberately NOT included here; it stays in the staff email only).
    const properties = { source: 'booking' };
    const interest = (data.service_interest || '').toString().trim().slice(0, 100);
    if (interest) properties.interest = interest;
    const page = (data.source_page || '').toString().slice(0, 100);
    if (page) properties.signup_page = page;
    if (data.utm_source) properties.utm_source = String(data.utm_source).slice(0, 60);
    if (data.utm_campaign) properties.utm_campaign = String(data.utm_campaign).slice(0, 60);
    maybeAddToAudience(env, waitUntil, {
      // Lowercase to match the newsletter path and the unsubscribe lookup (which always
      // PATCHes the lowercased address), so a mixed-case email can always be unsubscribed.
      email: email.toLowerCase(),
      firstName: parts[0] || name,
      lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
      properties,
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
    // LEAD_NOTIFY_TO may be a single address or a comma/semicolon-separated list (e.g.
    // "front@x.com, manager@x.com"). Split into an array so every inbox is notified; Resend
    // accepts an array of recipients. Whitespace and empty entries are trimmed out.
    const staffTo = String(env.LEAD_NOTIFY_TO || '')
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (staffTo.length) {
      // Tier-2 "review" leads still notify the front desk, but the subject is prefixed so a single
      // Gmail filter ("subject contains [Possible spam]") can archive them out of the main inbox.
      const staffSubject = (verdict === 'review' ? '[Possible spam] ' : '')
        + (type === 'appointment_request'
          ? `New appointment request: ${name}`
          : `New website inquiry: ${name}`);
      const html = staffHtml(data, { name, email, phone, type, glow: data.glow_summary || null });
      await send(staffTo, staffSubject, html, email || SITE.replyTo);
    }
  }

  // One-time "Welcome to Menon Medispa" email (~48h out), independent of the LEAD_FROM/staff block
  // above (it sends from the news subdomain). The 48h gap gives the front desk two days to reach out
  // personally first. Deduped per email; inert unless WELCOME_ENABLED is set.
  // BOOKINGS ONLY — a plain "Contact us" inquiry still gets its instant reply + a staff alert, but no
  // marketing welcome (and it is not added to the subscriber list above). Flagged leads get none.
  if (clean && type === 'appointment_request') {
    await maybeScheduleWelcome(env, waitUntil, {
      email,
      firstName: name.split(/\s+/)[0] || name,
      origin: new URL(request.url).origin,
      delayHours: 48,
      channel: 'booking',
    });
  }

  return json({ ok: true, id });
}
