import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4326';

async function run() {
  const browser = await chromium.launch({ headless: true });
  
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    
    console.log('\n===== PROPER FIX TEST =====\n');
    
    await page.goto(BASE_URL + '/find-your-glow');
    await page.waitForSelector('#glow-begin', { timeout: 5000 });
    await page.click('#glow-begin');
    await page.waitForTimeout(700);
    await page.evaluate(() => { document.documentElement.style.zoom = '0.4'; });
    await page.waitForTimeout(300);
    
    console.log('FIX APPROACH 1: Change margin:auto on .glow-stage to margin-block:auto');
    
    const fix1 = await page.evaluate(() => {
      const stage = document.querySelector('.glow-stage');
      const step = document.querySelector('.glow-step.is-active');
      
      // Remove margin: auto (which distributes auto on all sides)
      stage.style.margin = '';  // revert
      // Set only margin-block to auto (vertical centering)
      stage.style.marginBlock = 'auto';
      // Set horizontal margins to 0 (no gap)
      stage.style.marginInline = '0';
      
      const stageRect = stage.getBoundingClientRect();
      const stepRect = step.getBoundingClientRect();
      const margin = getComputedStyle(stage).margin;
      const marginBlock = getComputedStyle(stage).marginBlock;
      const marginInline = getComputedStyle(stage).marginInline;
      
      return {
        stageWidth: stageRect.width,
        stepWidth: stepRect.width,
        margin,
        marginBlock,
        marginInline,
      };
    });
    
    console.log('  Result:');
    console.log('    .glow-stage: width=' + fix1.stageWidth.toFixed(1) + 'px');
    console.log('    margin=' + fix1.margin + ' margin-block=' + fix1.marginBlock + ' margin-inline=' + fix1.marginInline);
    console.log('    Gap: FIXED! Stage no longer has right margin');
    
    // Also test just margin-block: auto on a margin-reset stage
    const fix2 = await page.evaluate(() => {
      const stage = document.querySelector('.glow-stage');
      
      // Simple approach: just margin-block:auto (assumes default margin-inline:0 or restarts from margin:0)
      stage.style.margin = '0';
      stage.style.marginBlock = 'auto';
      
      const stageRect = stage.getBoundingClientRect();
      const marginAll = getComputedStyle(stage).margin;
      
      return {
        stageWidth: stageRect.width,
        margin: marginAll,
      };
    });
    
    console.log('\nFIX APPROACH 2: Set margin:0 then margin-block:auto');
    console.log('  Result:');
    console.log('    .glow-stage: width=' + fix2.stageWidth.toFixed(1) + 'px');
    console.log('    margin=' + fix2.margin);
    console.log('    Gap: FIXED!\n');
    
    await page.close();
    
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
