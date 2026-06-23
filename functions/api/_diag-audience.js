// TEMPORARY diagnostic — DELETE after use. Token-guarded. Tests custom-property contact adds and
// supports batch cleanup. Reads server-side env (where the full-access key lives). NOT part of app.
const TOKEN = 'd9f1c0a7b6e54f2a8c3b1e7d4a09f622';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get('t') !== TOKEN) return new Response('forbidden', { status: 403 });
  const h = { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' };
  const aid = env.RESEND_AUDIENCE_ID;
  const out = {};

  // Verify Resend accepts ARBITRARY custom properties on a create (201 = safe to tag; 422 = props
  // must be pre-defined first). Then GET the contact back to confirm the properties persisted.
  const addprops = url.searchParams.get('addprops');
  if (addprops) {
    const email = addprops.toLowerCase();
    const pRes = await fetch(`https://api.resend.com/audiences/${aid}/contacts`, {
      method: 'POST', headers: h,
      body: JSON.stringify({
        email, unsubscribed: false, first_name: 'PropTest',
        properties: { source: 'booking', interest: 'Botox New Client Special', signup_page: '/botox-millburn-nj' },
      }),
    });
    out.addProps = { status: pRes.status, body: await pRes.json().catch(() => null) };
    const gRes = await fetch(`https://api.resend.com/audiences/${aid}/contacts/${encodeURIComponent(email)}`, { headers: h });
    out.getBack = { status: gRes.status, body: await gRes.json().catch(() => null) };
  }

  // Single-contact cleanup.
  const del = url.searchParams.get('del');
  if (del) {
    const dRes = await fetch(`https://api.resend.com/audiences/${aid}/contacts/${encodeURIComponent(del.toLowerCase())}`, { method: 'DELETE', headers: h });
    out.delResult = { status: dRes.status, body: await dRes.json().catch(() => null) };
  }

  return Response.json(out);
}

// Batch delete: POST { emails: ["a@b.com", ...] } → removes each from the audience. For pruning the
// broadcast's bounced list once exported.
export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get('t') !== TOKEN) return new Response('forbidden', { status: 403 });
  const h = { Authorization: `Bearer ${env.RESEND_API_KEY}` };
  const aid = env.RESEND_AUDIENCE_ID;
  let emails = [];
  try { emails = (await request.json()).emails || []; } catch { return Response.json({ error: 'bad_json' }, { status: 400 }); }
  const results = { requested: emails.length, deleted: 0, missing: 0, errors: [] };
  for (const raw of emails) {
    const email = String(raw).trim().toLowerCase();
    if (!email) continue;
    const dRes = await fetch(`https://api.resend.com/audiences/${aid}/contacts/${encodeURIComponent(email)}`, { method: 'DELETE', headers: h });
    if (dRes.status === 200) results.deleted++;
    else if (dRes.status === 404) results.missing++;
    else results.errors.push({ email, status: dRes.status });
  }
  return Response.json(results);
}
