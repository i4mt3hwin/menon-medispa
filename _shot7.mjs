import { chromium } from 'playwright';
const BASE='http://127.0.0.1:4321';
const b=await chromium.launch();
for (const [vp,w,h] of [['desktop',1440,900],['mobile',390,844]]) {
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:1});
  const p=await ctx.newPage();
  await p.goto(BASE+'/',{waitUntil:'load',timeout:30000});
  await p.waitForTimeout(2000);
  await p.screenshot({path:`_shots/hero-${vp}.png`,fullPage:false});
  console.log('hero',vp);
  await ctx.close();
}
await b.close();
