import { chromium } from 'playwright';
const BASE='http://127.0.0.1:4321';
const b=await chromium.launch();
// full-page desktop (scroll first to fire reveals)
let ctx=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
let p=await ctx.newPage();
await p.goto(BASE+'/',{waitUntil:'load',timeout:30000});
await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=500){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}window.scrollTo(0,0);});
await p.waitForTimeout(800);
await p.screenshot({path:'_shots/home-full-desktop.png',fullPage:true});
await p.locator('.intro-band').first().screenshot({path:'_shots/introband-desktop.png'});
await ctx.close();
// mobile intro band
ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
p=await ctx.newPage();
await p.goto(BASE+'/',{waitUntil:'load',timeout:30000});
await p.locator('.intro-band').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(700);
await p.locator('.intro-band').first().screenshot({path:'_shots/introband-mobile.png'});
await ctx.close();
await b.close();
console.log('done');
