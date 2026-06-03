// functions/api/lead.js — lead + appointment-request intake.
// Bindings (Cloudflare Pages -> Settings): D1 database `DB`; secrets RESEND_API_KEY,
// LEAD_NOTIFY_TO, LEAD_FROM. Resend secrets are DEFERRED (operator 2026-06-02): the
// Function persists to D1 even when the email env vars are unset (graceful degrade).
// NON-PHI store — see prompts/shared/reference/customer-data-best-practices.md.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

function esc(s) {
  return String(s || '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

export async function onRequestPost({ request, env }) {
  // Parse JSON or urlencoded form posts.
  let data = {};
  const ct = request.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) data = await request.json();
    else { for (const [k, v] of (await request.formData()).entries()) data[k] = v; }
  } catch { return json({ ok: false, error: 'bad_request' }, 400); }

  // Honeypot: a hidden field bots fill. Silently accept, store nothing.
  if (data.company_website) return json({ ok: true });

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

  // Insert the lead. (If DB binding is missing, surface a clear error.)
  if (!env.DB) return json({ ok: false, error: 'db_unbound' }, 500);
  await env.DB.prepare(
    `INSERT INTO leads (id, created_at, type, status, name, email, phone, service_interest, message,
       preferred_date, preferred_window, source_page, utm_source, utm_medium, utm_campaign, utm_term, utm_content, user_agent)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id, now, type, 'new', name, email, phone,
    (data.service_interest || '').slice(0, 120), (data.message || '').slice(0, 2000),
    data.preferred_date || null, data.preferred_window || null,
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

  // Notify the business via Resend. DEFERRED: only fires if all three env vars are set.
  // The lead is already persisted above, so email is best-effort (never loses a lead).
  if (env.RESEND_API_KEY && env.LEAD_NOTIFY_TO && env.LEAD_FROM) {
    const subject = type === 'appointment_request'
      ? `New appointment request — ${esc(name)}`
      : `New website inquiry — ${esc(name)}`;
    const rows = [
      ['Name', name], ['Email', email], ['Phone', phone],
      ['Service interest', data.service_interest], ['Preferred date', data.preferred_date],
      ['Preferred window', data.preferred_window], ['Message', data.message],
      ['Page', data.source_page]
    ].filter(([, v]) => v).map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('');
    const send = (to, html) => fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.LEAD_FROM, to, subject, html })
    }).catch(() => {});
    await send(env.LEAD_NOTIFY_TO, `<h2>${esc(subject)}</h2><table>${rows}</table>`);
    if (email && (data.send_confirmation === 'on' || data.send_confirmation === 'true')) {
      await send(email, `<p>Thanks ${esc(name)} — we received your ${type === 'appointment_request' ? 'appointment request' : 'message'} and will be in touch shortly.</p>`);
    }
  }

  return json({ ok: true, id });
}
