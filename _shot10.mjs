import { chromium } from 'playwright';
const BASE='http://127.0.0.1:4321';
const b=await chromium.launch();
for (const [vp,w,h] of [['desktop',1440,900],['mobile',390,844]]) {
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1});
  const p=await ctx.newPage();
  await p.goto(BASE+'/',{waitUntil:'load',timeout:30000});
  await p.waitForTimeout(1000);
  const loc=p.locator('.welcome-section').first();
  await loc.scrollIntoViewIfNeeded(); await p.waitForTimeout(700);
  await loc.screenshot({path:`_shots/welcome3-${vp}.png`});
  console.log('welcome3',vp);
  await ctx.close();
}
await b.close();
