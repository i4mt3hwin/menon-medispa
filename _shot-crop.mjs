import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = 'http://127.0.0.1:' + (process.env.QA_PORT || '4400');
const slug = process.argv[2] || 'botox-millburn-nj';
const OUT = '_shots/crop';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

// Desktop hero + article (viewport shots, motion reduced so reveal shows)
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();
await page.goto(`${BASE}/${slug}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/${slug}-hero.png` });            // top viewport (hero)
// scroll to the two-column article
await page.evaluate(() => { const s = document.querySelector('.service-article'); if (s) s.scrollIntoView(); });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/${slug}-article.png` });
await ctx.close();

// Mobile: top (hero) + bottom (fixed CTA bar)
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const mp = await m.newPage();
await mp.goto(`${BASE}/${slug}`, { waitUntil: 'networkidle' });
await mp.waitForTimeout(400);
await mp.screenshot({ path: `${OUT}/${slug}-m-top.png` });
await mp.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await mp.waitForTimeout(400);
await mp.screenshot({ path: `${OUT}/${slug}-m-bottom.png` });
await m.close();

await browser.close();
console.log('crop shots done for ' + slug);
