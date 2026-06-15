import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = 'http://127.0.0.1:4321';
const OUT = '_shots';
mkdirSync(OUT, { recursive: true });

const targets = [
  ['marquee', '.featured-in'],
  ['testimonial', 'section:has(.review-card)'],
  ['services', '.home-section-8'],
  ['contact', '.home-section-12'],
  ['newsletter', '.footer-newsletter'],
];

const browser = await chromium.launch();
for (const [vp, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(700);
  for (const [name, sel] of targets) {
    try {
      const loc = page.locator(sel).first();
      await loc.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      await loc.screenshot({ path: `${OUT}/sec-${name}-${vp}.png` });
      console.log('shot', name, vp);
    } catch (e) { console.log('FAIL', name, vp, e.message.split('\n')[0]); }
  }
  await ctx.close();
}
await browser.close();
console.log('done');
