import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = 'http://127.0.0.1:4321';
const OUT = '_shots';
mkdirSync(OUT, { recursive: true });
const pages = [['home', '/'], ['botox', '/botox-millburn-nj'], ['face', '/face'], ['service-page', '/service-page/botox-injectables']];
const browser = await chromium.launch();
for (const [name, path] of pages) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  try { await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 }); }
  catch { await page.goto(BASE + path, { waitUntil: 'load', timeout: 30000 }); }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/atf-${name}.png`, fullPage: false });
  console.log('atf:', name);
  await ctx.close();
}
await browser.close();
console.log('done');
