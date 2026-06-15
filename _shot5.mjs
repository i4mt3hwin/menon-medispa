import { chromium } from 'playwright';
const BASE='http://127.0.0.1:4321';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
const p=await ctx.newPage();
await p.goto(BASE+'/',{waitUntil:'load',timeout:30000});
await p.waitForTimeout(2000); // let entrance animation finish
await p.screenshot({path:'_shots/atf2-home.png',fullPage:false});
console.log('done');
await b.close();
