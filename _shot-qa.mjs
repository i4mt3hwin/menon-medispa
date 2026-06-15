import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

// Usage: node _shot-qa.mjs [comma-separated routes]
// Captures full-page shots at 1440 / 768 / 390 for representative re-skinned pages.
const BASE = 'http://127.0.0.1:' + (process.env.QA_PORT || '4321');
const OUT = '_shots/qa';
mkdirSync(OUT, { recursive: true });

// Representative sample across every family (override via argv[2]).
const DEFAULT = [
  // service (incl. the XL ones)
  'microneedling-millburn-nj', 'hydrafacial', 'iv-therapy-millburn-nj', 'acne-facial', 'semaglutide', 'laser-hair-removal',
  // pillar
  'face', 'body', 'hair',
  // about
  'about', 'meet-the-team',
  // contact-booking
  'contact', 'consultation', 'memberships', 'gift-card',
  // legal
  'terms-of-use', 'store-policy', 'patient-resources',
  // promo / thank-you
  'sale', 'coming-soon', 'hydrafacial-appointment-request-thanks',
];

const arg = process.argv[2];
const slugs = arg ? arg.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT;

const viewports = [
  ['desktop', 1440, 900],
  ['tablet', 768, 1024],
  ['mobile', 390, 844],
];

const browser = await chromium.launch();
let overflow = [];
for (const slug of slugs) {
  const path = '/' + slug;
  for (const [vp, w, h] of viewports) {
    // reducedMotion:'reduce' disables the scroll-reveal hidden state (it's gated on
    // prefers-reduced-motion:no-preference), so full-page shots show all sections.
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
    } catch {
      try { await page.goto(BASE + path, { waitUntil: 'load', timeout: 30000 }); }
      catch (e) { console.log(`FAIL ${slug}-${vp}: ${e.message}`); await ctx.close(); continue; }
    }
    await page.waitForTimeout(500);
    // horizontal-overflow check (mobile especially)
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    if (sw > w + 1) overflow.push(`${slug}-${vp} (scrollWidth ${sw} > ${w})`);
    await page.screenshot({ path: `${OUT}/${slug}-${vp}.png`, fullPage: true });
    console.log(`shot: ${slug}-${vp}${sw > w + 1 ? '  <-- OVERFLOW' : ''}`);
    await ctx.close();
  }
}
await browser.close();
console.log('\ndone. ' + slugs.length + ' pages.');
if (overflow.length) console.log('HORIZONTAL OVERFLOW:\n  ' + overflow.join('\n  '));
else console.log('no horizontal overflow detected.');
