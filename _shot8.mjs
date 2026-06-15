import { chromium } from 'playwright';
const BASE='http://127.0.0.1:4321';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
const p=await ctx.newPage();
await p.goto(BASE+'/',{waitUntil:'load',timeout:30000});
await p.waitForTimeout(1800);
await p.screenshot({path:'_shots/hero2-desktop.png',fullPage:false});
// scroll to welcome + screenshot
const w=p.locator('.welcome-section').first();
await w.scrollIntoViewIfNeeded(); await p.waitForTimeout(900);
await w.screenshot({path:'_shots/welcome2.png'});
// reveal check: scroll through page, then count visible sections
await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,80));}});
await p.waitForTimeout(500);
const stats=await p.evaluate(()=>{const s=[...document.querySelectorAll('body > section:not(.hero)')];return {total:s.length, visible:s.filter(e=>e.classList.contains('is-visible')).length};});
console.log('reveal sections:', JSON.stringify(stats));
await b.close();
