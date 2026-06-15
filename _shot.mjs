import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'http://127.0.0.1:4321';
const OUT = '_shots';
mkdirSync(OUT, { recursive: true });

const pages = [
  ['home', '/'],
  ['botox', '/botox-millburn-nj'],
  ['service-page', '/service-page/botox-injectables'],
  ['face', '/face'],
  ['post', '/post/is-botox-safe'],
];
const viewports = [
  ['desktop', 1440, 900],
  ['tablet', 768, 1024],
  ['mobile', 390, 844],
];

const browser = await chromium.launch();
for (const [name, path] of pages) {
  for (const [vp, w, h] of viewports) {
    // tablet only for home + botox to keep it quick
    if (vp === 'tablet' && !['home', 'botox'].includes(name)) continue;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
    } catch {
      await page.goto(BASE + path, { waitUntil: 'load', timeout: 30000 });
    }
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${name}-${vp}.png`, fullPage: true });
    console.log(`shot: ${name}-${vp}`);
    await ctx.close();
  }
}
await browser.close();
console.log('done');
