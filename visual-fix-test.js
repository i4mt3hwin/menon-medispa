import { chromium } from 'playwright';
import fs from 'fs';

const BASE_URL = 'http://localhost:4326';
const baseDir = '/tmp/glow-diagnostic';

async function run() {
  const browser = await chromium.launch({ headless: true });
  
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    
    await page.goto(BASE_URL + '/find-your-glow');
    await page.waitForSelector('#glow-begin', { timeout: 5000 });
    await page.click('#glow-begin');
    await page.waitForTimeout(700);
    await page.evaluate(() => { document.documentElement.style.zoom = '0.4'; });
    await page.waitForTimeout(300);
    
    // Screenshot BEFORE fix
    console.log('Taking screenshot BEFORE fix...');
    await page.screenshot({ path: baseDir + '/BEFORE-fix-broken.png' });
    
    // Apply fix
    console.log('Applying fix: margin:0 + margin-block:auto');
    await page.evaluate(() => {
      const stage = document.querySelector('.glow-stage');
      stage.style.margin = '0';
      stage.style.marginBlock = 'auto';
      
      // Add visual marker
      stage.style.border = '2px solid green';
      stage.style.background = 'rgba(0,255,0,0.05)';
    });
    await page.waitForTimeout(300);
    
    // Screenshot AFTER fix
    console.log('Taking screenshot AFTER fix...');
    await page.screenshot({ path: baseDir + '/AFTER-fix-working.png' });
    
    console.log('Screenshots saved!');
    
    await page.close();
    
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
