import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = 'http://127.0.0.1:' + (process.env.QA_PORT || '4415');
const slug = process.argv[2] || 'botox-millburn-nj';
const OUT = '_shots/hero';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

// MOTION ON + simulate cursor in the hero to trigger the spotlight reveal
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/${slug}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);                 // let entrance finish
await page.mouse.move(1050, 360, { steps: 12 }); // move cursor into the right side of the hero
await page.waitForTimeout(700);                   // let the spotlight lerp + draw
await page.screenshot({ path: `${OUT}/${slug}-spotlight.png` });
// move to a different spot
await page.mouse.move(760, 300, { steps: 12 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/${slug}-spotlight2.png` });
await ctx.close();

// REDUCED MOTION — static base, no spotlight, text visible
const r = await browser.newContext({ viewport: { width: 1440, height: 860 }, reducedMotion: 'reduce' });
const rp = await r.newPage();
await rp.goto(`${BASE}/${slug}`, { waitUntil: 'networkidle' });
await rp.waitForTimeout(500);
await rp.screenshot({ path: `${OUT}/${slug}-reduced.png` });
await r.close();

await browser.close();
console.log('hero shots done: ' + slug);
