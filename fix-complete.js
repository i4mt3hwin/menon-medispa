import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4326';

async function run() {
  const browser = await chromium.launch({ headless: true });
  
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    
    console.log('\n===== COMPLETE ROOT CAUSE ANALYSIS =====\n');
    
    await page.goto(BASE_URL + '/find-your-glow');
    await page.waitForSelector('#glow-begin', { timeout: 5000 });
    await page.click('#glow-begin');
    await page.waitForTimeout(700);
    await page.evaluate(() => { document.documentElement.style.zoom = '0.4'; });
    await page.waitForTimeout(300);
    
    // The real issue
    const issue = await page.evaluate(() => {
      const quiz = document.querySelector('.glow-quiz');
      const stage = document.querySelector('.glow-stage');
      const step = document.querySelector('.glow-step.is-active');
      
      const quizRect = quiz.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const stepRect = step.getBoundingClientRect();
      
      const cs = getComputedStyle(quiz);
      
      return {
        viewport: window.innerWidth,
        quizWidth: quizRect.width,
        quizAlignItems: cs.alignItems,
        stageWidth: stageRect.width,
        stageMarginInline: getComputedStyle(stage).marginInline,
        stepWidth: stepRect.width,
      };
    });
    
    console.log('CURRENT STATE (BROKEN):');
    console.log('  viewport: ' + issue.viewport + 'px');
    console.log('  .glow-quiz width: ' + issue.quizWidth.toFixed(1) + 'px (fills viewport)');
    console.log('  .glow-quiz align-items: ' + issue.quizAlignItems + ' (PROBLEM!)');
    console.log('  .glow-stage width: ' + issue.stageWidth.toFixed(1) + 'px (centered, margin:auto creates gap)');
    console.log('  .glow-stage margin-inline: ' + issue.stageMarginInline);
    console.log('  RIGHT GAP: ' + (issue.viewport - issue.stageWidth).toFixed(1) + 'px (visible as empty space)\n');
    
    // Apply fix
    const fixed = await page.evaluate(() => {
      const quiz = document.querySelector('.glow-quiz');
      const stage = document.querySelector('.glow-stage');
      const step = document.querySelector('.glow-step.is-active');
      
      // THE FIX: Add align-items: stretch to the flex-column container
      quiz.style.alignItems = 'stretch';
      
      const quizRect = quiz.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const stepRect = step.getBoundingClientRect();
      
      return {
        viewport: window.innerWidth,
        quizWidth: quizRect.width,
        stageWidth: stageRect.width,
        stepWidth: stepRect.width,
      };
    });
    
    console.log('AFTER FIX: .glow-quiz { align-items: stretch; }');
    console.log('  .glow-quiz width: ' + fixed.quizWidth.toFixed(1) + 'px');
    console.log('  .glow-stage width: ' + fixed.stageWidth.toFixed(1) + 'px');
    console.log('  .glow-step width: ' + fixed.stepWidth.toFixed(1) + 'px');
    console.log('  RIGHT GAP: ' + (fixed.viewport - fixed.stageWidth).toFixed(1) + 'px\n');
    
    if (fixed.stageWidth > issue.stageWidth) {
      console.log('SUCCESS: Stage now stretches more horizontally!');
    }
    
    await page.close();
    
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
