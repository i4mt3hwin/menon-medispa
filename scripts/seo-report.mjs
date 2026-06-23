/**
 * seo-report.mjs — assemble the final SEO audit markdown from the workflow result
 * (.seo-audit-result.json) + deterministic facts (.seo-facts.json).
 * Decodes HTML entities, lints every proposed rewrite for brand-voice violations,
 * and writes SEO-AUDIT-2026-06-22.md at the project root.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const R = JSON.parse(readFileSync('scripts/.seo-audit-result.json', 'utf8'));
const FACTS = JSON.parse(readFileSync('scripts/.seo-facts.json', 'utf8'));
const factByRoute = Object.fromEntries(FACTS.map((f) => [f.route, f]));
const { pages, siteWide } = R;

// ---- helpers ----
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ', '&eacute;': 'é', '&Eacute;': 'É', '&reg;': '®', '&trade;': '™', '&times;': '×', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&hellip;': '…', '&mdash;': '--', '&ndash;': '-' };
function dec(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&[a-zA-Z#0-9]+;/g, (m) => (ENT[m] ?? (m.startsWith('&#') ? String.fromCharCode(parseInt(m.slice(2, -1).replace('x', ''), m[2] === 'x' ? 16 : 10)) : m)));
}
// brand-voice lint on proposed copy
const SUPERLATIVE = /\b(best|#1|number one|top-rated|world-class|guaranteed|painless|miracle|leading|premier)\b/i;
function voiceFlags(s) {
  const f = [];
  const t = dec(s);
  if (/[—]/.test(t) || /\s--\s/.test(t)) f.push('em-dash');
  if (/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(t)) f.push('emoji');
  if (SUPERLATIVE.test(t)) f.push('superlative:' + (t.match(SUPERLATIVE) || [])[0]);
  return f;
}
const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
const gradeIcon = { pass: 'PASS', warn: 'WARN', fail: 'FAIL' };

// ---- collect voice-lint warnings across all recommendations ----
const lint = [];
for (const p of pages) {
  for (const dim of ['title', 'description', 'h1']) {
    const rec = p[dim]?.recommendation;
    const fl = rec ? voiceFlags(rec) : [];
    if (fl.length) lint.push(`${p.route} ${dim}: [${fl.join(', ')}] "${dec(rec).slice(0, 80)}"`);
  }
}

let md = [];
const P = (...l) => md.push(...l);

P('# Menon Medispa & Wellness — Comprehensive SEO Audit');
P('');
P('_Generated 2026-06-22. Scope: all 92 rendered pages (`05-build/dist`), audited against on-page SEO best practices. Method: deterministic extraction (parse5) of every title / meta / H1 / heading outline / image alt / JSON-LD / link, then a 13-agent deep audit (per-page clusters + global + cannibalization + schema), cross-checked against the Lighthouse mobile report._');
P('');

// ---- scorecard ----
const cnt = (f) => pages.reduce((m, p) => { const k = f(p); m[k] = (m[k] || 0) + 1; return m; }, {});
const prio = cnt((p) => p.priority);
P('## Scorecard');
P('');
P('| Element | PASS | WARN | FAIL |');
P('|---|---|---|---|');
for (const dim of ['title', 'description', 'h1', 'headings', 'images', 'schema']) {
  const g = cnt((p) => p[dim]?.grade || '?');
  P(`| ${dim[0].toUpperCase() + dim.slice(1)} | ${g.pass || 0} | ${g.warn || 0} | ${g.fail || 0} |`);
}
P('');
P(`**Page priority mix:** P0 ${prio.P0 || 0} · P1 ${prio.P1 || 0} · P2 ${prio.P2 || 0} · P3 ${prio.P3 || 0}  (of ${pages.length} pages)`);
P('');
P('**Lighthouse (mobile, Slow 4G):** Performance 67 · Accessibility 93 · Best Practices 96 · SEO 92. LCP 9.2s **fails** Core Web Vitals (a ranking signal); CLS 0 (good).');
P('');
P('**Clean across the board:** all 87 indexable canonicals are correct and self-referential; every `<img>` has an alt attribute; no duplicate titles or H1s; meta descriptions present on every page; `noindex` correctly applied to the 5 thank-you/booking/coming-soon pages; `lang="en"` + viewport everywhere.');
P('');

// ---- top themes ----
P('## What to fix first (themes)');
P('');
P('1. **Core Web Vitals — LCP 9.2s.** The biggest ranking risk. Oversized images (service tiles served 1333×2000 for an ~658px slot; testimonial avatars are 240×240 PNGs shown at 77×77 and not webp), render-blocking CSS (~1.4s), and the Facebook pixel shipping legacy JS. ~838 KiB of image savings available.');
P('2. **Missing LocalBusiness schema on /contact.** The page with the full NAP, map and hours has no JSON-LD — the single most valuable place for it. (Homepage has it; contact does not.)');
P('3. **Descriptions under-use the snippet.** 31 indexable descriptions are under 120 chars; several lead with unsubstantiated superlatives ("top-rated"). Rewrite to 140–160 chars with keyword + geo + soft CTA.');
P('4. **Titles run long.** 26 titles exceed 65 chars and will truncate in SERPs (mostly blog posts + a few service/pillar pages).');
P('5. **H1s are brand/emotive, not keyworded.** 41 H1s "warn" — aspirational hero lines with no primary keyword or geo on pages where that weight matters.');
P('6. **Alt-text quality.** Generic/legacy/mismatched alts (logo "Medispa Logo"; avatars "Picture of a Client Who Reviewed Us"; "Injection cosmetology"; a HydraFacial card labelled "Hair Restoration"). Attributes exist; the *text* needs work.');
P('7. **Keyword cannibalization & thin booking pages.** Overlapping booking routes (/book-online, /online-booking, /request-appointment, /consultation) and overlapping facial/IV pages compete for the same queries.');
P('8. **Heading hierarchy skips levels** on 10 pages (home h2→h5, several posts h1→h3).');
P('9. **Duplicate content:** two blog posts ship as `-1` duplicates with identical meta (QWO, lymphatic-drainage).');
P('10. **16 indexable pages have no structured data** (/about, /contact, /meet-the-team, /memberships, /find-your-glow, etc.).');
P('');

if (lint.length) {
  P('> **Voice-lint note:** the following proposed rewrites tripped the brand-voice check (em dash / emoji / superlative) and should be adjusted before use:');
  P('>');
  for (const l of lint) P('> - ' + l);
  P('');
}

// ---- verification & corrections (adversarial check of falsifiable agent claims vs the live dist) ----
P('## Verification & corrections');
P('');
P('_Falsifiable agent claims were re-checked against the rendered `dist/`. Results:_');
P('');
P('- ✅ **CONFIRMED — /contact ships zero JSON-LD.** `dist/contact/index.html` has 0 `ld+json` blocks. P0 stands.');
P('- ✅ **CONFIRMED — canonical/sitemap trailing-slash mismatch.** Pages emit canonical `…/botox-millburn-nj` (no slash) while the sitemap lists `…/botox-millburn-nj/`; homepage canonical is `https://www.menonmedispa.com` (no slash). Self-conflicting signal across all pages.');
P('- ✅ **CONFIRMED — /online-booking is indexable + thin** (title "Online Booking | Menon Medispa", 31 chars, no `noindex`). The two duplicate `-1` blog posts (QWO, lymphatic-drainage) both exist in `dist`.');
P('- ❌ **CORRECTED — `/service-page/botox-injectables` and `/booking-calendar/*` do NOT exist in the current build.** Two cannibalization findings reference them as "thin Botox/booking URLs"; they are legacy plan-CSV/archive artifacts, not live pages. Disregard those sub-recommendations. The real booking funnel is 4 URLs (`/book-online` noindex, `/online-booking` indexable-thin, `/request-appointment`, `/consultation`), and the `/fillers-injectables` title double-targeting Botox/Juvéderm still stands.');
P('- ⚠️ **CORRECTED — the `/shipping-and-returns` "Free Shipping…l" trailing-typo is NOT in the live build.** Live description is clean ("…return & exchange policy details.") though short at ~96 chars.');
P('');

// ---- site-wide findings ----
function findingBlock(title, arr) {
  P(`### ${title}`);
  P('');
  const sorted = [...arr].sort((a, b) => (order[a.severity] - order[b.severity]));
  for (const f of sorted) {
    P(`- **[${f.severity}] ${dec(f.title)}** _(${dec(f.category)})_`);
    P(`  - ${dec(f.detail)}`);
    P(`  - **Fix:** ${dec(f.recommendation)}`);
    if (f.affectedRoutes && f.affectedRoutes.length) P(`  - Affects: ${f.affectedRoutes.map(dec).join(', ')}`);
  }
  P('');
}
P('## Site-wide findings');
P('');
findingBlock('Global chrome, meta scaffold & technical', siteWide.global || []);
findingBlock('Keyword cannibalization & internal linking', siteWide.cannibalization || []);
findingBlock('Structured data, duplicate content & geo', siteWide.schema || []);

// ---- per-page detail (warn/fail dimensions only), grouped by priority ----
P('## Page-by-page recommendations');
P('');
P('_Only flagged dimensions are shown per page; unlisted elements passed. Char counts in (parentheses)._');
P('');
const byPrio = [...pages].sort((a, b) => (order[a.priority] - order[b.priority]) || a.route.localeCompare(b.route));
let curPrio = null;
const prioLabel = { P0: 'P0 — Critical', P1: 'P1 — High', P2: 'P2 — Medium', P3: 'P3 — Low' };
for (const p of byPrio) {
  if (p.priority !== curPrio) { curPrio = p.priority; P(`### ${prioLabel[curPrio] || curPrio}`); P(''); }
  const lines = [];
  const t = p.title, d = p.description, h = p.h1;
  if (t && t.grade !== 'pass') {
    lines.push(`- **Title** ${gradeIcon[t.grade]} (${t.len}): ${(t.issues || []).map(dec).join(' ') || ''}`);
    if (t.recommendation) lines.push(`  - → \`${dec(t.recommendation)}\`${t.recommendedLen ? ` (${t.recommendedLen})` : ''}`);
  }
  if (d && d.grade !== 'pass') {
    lines.push(`- **Description** ${gradeIcon[d.grade]} (${d.len}): ${(d.issues || []).map(dec).join(' ') || ''}`);
    if (d.recommendation) lines.push(`  - → \`${dec(d.recommendation)}\`${d.recommendedLen ? ` (${d.recommendedLen})` : ''}`);
  }
  if (h && h.grade !== 'pass') {
    lines.push(`- **H1** ${gradeIcon[h.grade]} (current: "${dec(h.current)}"): ${(h.issues || []).map(dec).join(' ') || ''}`);
    if (h.recommendation) lines.push(`  - → ${dec(h.recommendation)}`);
  }
  if (p.headings && p.headings.grade !== 'pass' && (p.headings.issues || []).length) {
    lines.push(`- **Headings** ${gradeIcon[p.headings.grade]}: ${p.headings.issues.map(dec).join(' ')}`);
  }
  if (p.images && p.images.grade !== 'pass' && (p.images.issues || []).length) {
    for (const im of p.images.issues) lines.push(`- **Alt** \`"${dec(im.alt)}"\`: ${dec(im.problem)} → ${dec(im.recommendation)}`);
  }
  if (p.schema && p.schema.grade !== 'pass') {
    lines.push(`- **Schema** ${gradeIcon[p.schema.grade]}: have [${(p.schema.present || []).map(dec).join(', ') || 'none'}]; add [${(p.schema.missing || []).map(dec).join(', ') || '-'}]`);
  }
  for (const o of (p.other || [])) lines.push(`- **Other [${o.severity}]**: ${dec(o.issue)} → ${dec(o.recommendation)}`);

  P(`#### \`${p.route}\` — ${dec(p.pageType)}`);
  if (lines.length) P(...lines); else P('- All audited elements passed.');
  if (p.topFixes && p.topFixes.length) P(`- **Top fixes:** ${p.topFixes.map(dec).join(' / ')}`);
  P('');
}

// ---- full matrix ----
P('## Appendix A — Full page matrix (all pages)');
P('');
P('| Route | Pri | Title | Desc | H1 | Head | Img | Schema |');
P('|---|---|---|---|---|---|---|---|');
const g = (x) => x ? (x.grade === 'pass' ? '·' : x.grade === 'warn' ? 'W' : 'F') : '?';
for (const p of byPrio) {
  P(`| \`${p.route}\` | ${p.priority} | ${g(p.title)}${p.title ? ' ' + p.title.len : ''} | ${g(p.description)}${p.description ? ' ' + p.description.len : ''} | ${g(p.h1)} | ${g(p.headings)} | ${g(p.images)} | ${g(p.schema)} |`);
}
P('');
P('_Legend: `·` pass · `W` warn · `F` fail. Title/Desc cells show character count._');
P('');

P('## Appendix B — Method & data files');
P('');
P('- `05-build/scripts/seo-extract.mjs` — parse5 extractor → `.seo-facts.json` (raw, every element).');
P('- `05-build/scripts/.seo-metrics-table.txt` — deterministic length/grade table for all indexable pages.');
P('- `05-build/scripts/.seo-audit-result.json` — full 13-agent structured output.');
P('- `05-build/scripts/seo-audit.workflow.mjs` — the audit workflow (re-runnable after edits).');
P('- Re-run: `npm run build` then `node scripts/seo-extract.mjs` to refresh facts.');
P('');

writeFileSync('../SEO-AUDIT-2026-06-22.md', md.join('\n'));
console.log('Report written to menon-medispa/SEO-AUDIT-2026-06-22.md. Lines:', md.length, '| voice-lint flags:', lint.length);
