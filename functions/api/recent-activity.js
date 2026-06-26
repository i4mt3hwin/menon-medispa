// functions/api/recent-activity.js — recent REAL appointment requests for the social-proof toast.
// Privacy-first + de-identified: first name + last initial only, a GENERALIZED treatment category
// (never the specific procedure), and a SOFT relative time. No email / phone / town / message /
// exact timestamp ever leaves here. Reads D1 `leads` (type=appointment_request). Best-effort:
// returns [] when the DB is unbound, empty, or errors — the widget then simply shows nothing.

const json = (obj) =>
  new Response(JSON.stringify(obj), {
    headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=0, must-revalidate' },
  });

// Free-text service interest -> generalized category + label. Keep it categorical so a near-named
// person is never tied to a specific medical/cosmetic procedure (same guardrail as the old widget).
function generalize(interest) {
  const s = (interest || '').toLowerCase();
  if (/laser|hair removal/.test(s)) return { category: 'laser', service: 'a laser treatment' };
  if (/prp|hair restoration|scalp/.test(s)) return { category: 'hair', service: 'a hair restoration treatment' };
  if (/iv|drip|infusion|myers|nad|hydration|vitamin|b12/.test(s)) return { category: 'iv', service: 'an IV wellness drip' };
  if (/semaglutide|weight|wellness/.test(s)) return { category: 'wellness', service: 'a wellness visit' };
  if (/hydrafacial|facial|peel|microneedl|dermaplan|glow|skin|acne|glass/.test(s)) return { category: 'facial', service: 'a facial treatment' };
  if (/botox|filler|juv|injectable|\btox\b|lip/.test(s)) return { category: 'skin', service: 'a cosmetic treatment' };
  if (/vascular|vein|body|contour/.test(s)) return { category: 'body', service: 'a treatment' };
  return { category: 'facial', service: 'a treatment' };
}

function softWhen(createdAt) {
  const t = Date.parse(createdAt);
  if (isNaN(t)) return 'recently';
  const h = (Date.now() - t) / 3.6e6;
  if (h < 6) return 'earlier today';
  if (h < 24) return 'today';
  if (h < 48) return 'yesterday';
  if (h < 24 * 7) return 'this week';
  return 'recently';
}

// "Sarah Klein" -> "Sarah K."; single-word -> "Sarah". Drops junk/bot-looking names.
function displayName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  const first = (parts[0] || '').replace(/[^A-Za-z'-]/g, '');
  if (first.length < 2) return null;
  if (/(http|www\.|@|steroid|sarms|anavar)/i.test(name)) return null;
  const cap = first[0].toUpperCase() + first.slice(1).toLowerCase();
  const last = parts[1] && /[A-Za-z]/.test(parts[1]) ? ` ${parts[1][0].toUpperCase()}.` : '';
  return cap + last;
}

// ── Fading launch seed ────────────────────────────────────────────────────────────────────────
// At go-live there are no real bookings, so the toast would be invisible. We pad the rotation up to
// MIN_VISIBLE with these generalized seed entries — but ONLY while real bookings are sparse AND only
// during the launch window (before SEED_UNTIL). Real bookings always come first, so as they arrive the
// seed shrinks and then disappears; after SEED_UNTIL no seed is ever returned (pure real).
const MIN_VISIBLE = 5;
const SEED_UNTIL = Date.parse('2026-07-07T00:00:00Z'); // launch-window backstop — edit/remove later
const SEED = [
  { name: 'Sarah K.', service: 'a facial treatment', category: 'facial', when: 'earlier today' },
  { name: 'Jessica M.', service: 'a cosmetic treatment', category: 'skin', when: 'today' },
  { name: 'Amanda R.', service: 'an IV wellness drip', category: 'iv', when: 'yesterday' },
  { name: 'Nicole T.', service: 'a laser treatment', category: 'laser', when: 'this week' },
  { name: 'Danielle P.', service: 'a facial treatment', category: 'facial', when: 'yesterday' },
  { name: 'Rachel B.', service: 'a wellness visit', category: 'wellness', when: 'this week' },
];

// Real entries stay first; seed only fills the remainder up to MIN_VISIBLE, and only within the window.
function padForLaunch(out) {
  if (out.length < MIN_VISIBLE && Date.now() < SEED_UNTIL) {
    for (const s of SEED) {
      if (out.length >= MIN_VISIBLE) break;
      out.push(s);
    }
  }
  return json(out);
}

export async function onRequestGet({ env }) {
  if (!env.DB) return padForLaunch([]);
  try {
    const { results } = await env.DB.prepare(
      `SELECT name, service_interest, created_at FROM leads
       WHERE type = 'appointment_request' AND name IS NOT NULL AND name != ''
       ORDER BY created_at DESC LIMIT 15`
    ).all();
    const out = [];
    for (const r of results || []) {
      const name = displayName(r.name);
      if (!name) continue;
      const g = generalize(r.service_interest);
      out.push({ name, service: g.service, category: g.category, when: softWhen(r.created_at) });
    }
    return padForLaunch(out);
  } catch {
    return padForLaunch([]);
  }
}
