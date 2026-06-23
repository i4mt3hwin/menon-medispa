import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4326';

async function run() {
  const browser = await chromium.launch({ headless: true });
  
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    
    console.log('\n===== ROOT CAUSE & FIX TEST =====\n');
    
    await page.goto(BASE_URL + '/find-your-glow');
    await page.waitForSelector('#glow-begin', { timeout: 5000 });
    await page.click('#glow-begin');
    await page.waitForTimeout(700);
    await page.evaluate(() => { document.documentElement.style.zoom = '0.4'; });
    await page.waitForTimeout(300);
    
    // Get baseline
    const baseline = await page.evaluate(() => {
      const quiz = document.querySelector('.glow-quiz');
      const stage = document.querySelector('.glow-stage');
      const stageRect = stage.getBoundingClientRect();
      const marginComputed = getComputedStyle(stage).margin;
      
      return {
        display: getComputedStyle(quiz).display,
        flexDir: getComputedStyle(quiz).flexDirection,
        alignItems: getComputedStyle(quiz).alignItems,
        stageWidth: stageRect.width,
        margin: marginComputed,
      };
    });
    
    console.log('BASELINE (BROKEN):');
    console.log('  .glow-quiz: display=' + baseline.display + ' flex-direction=' + baseline.flexDir + ' align-items=' + baseline.alignItems);
    console.log('  .glow-stage: width=' + baseline.stageWidth.toFixed(1) + 'px margin=' + baseline.margin);
    console.log('  ISSUE: .glow-stage has huge margin values due to "margin: auto" on flex-column child');
    
    // Test fix: margin-block: auto
    const fix1 = await page.evaluate(() => {
      const stage = document.querySelector('.glow-stage');
      stage.style.margin = '0';
      stage.style.marginBlock = 'auto';
      
      const stageRect = stage.getBoundingClientRect();
      const marginComputed = getComputedStyle(stage).margin;
      const marginBlock = getComputedStyle(stage).marginBlock;
      
      return {
        stageWidth: stageRect.width,
        margin: marginComputed,
        marginBlock: marginBlock,
      };
    });
    
    console.log('\nFIX: Change .glow-stage from margin:auto to margin:0 + margin-block:auto');
    console.log('  .glow-stage: width=' + fix1.stageWidth.toFixed(1) + 'px margin=' + fix1.margin + ' margin-block=' + fix1.marginBlock);
    console.log('  RESULT: Stage now stretches horizontally, auto margins only on block axis');
    
    await page.close();
    
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
