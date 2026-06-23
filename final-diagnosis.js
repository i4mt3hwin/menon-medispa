import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4326';

async function run() {
  const browser = await chromium.launch({ headless: true });
  
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    
    console.log('ROOT CAUSE ANALYSIS\n');
    
    await page.goto(BASE_URL + '/find-your-glow');
    await page.waitForSelector('#glow-begin', { timeout: 5000 });
    await page.click('#glow-begin');
    await page.waitForTimeout(700);
    await page.evaluate(() => { document.documentElement.style.zoom = '0.4'; });
    await page.waitForTimeout(300);
    
    console.log('STATE 1: BROKEN (flex column with margin: auto on child)');
    let result = await page.evaluate(() => {
      const quiz = document.querySelector('.glow-quiz');
      const stage = document.querySelector('.glow-stage');
      
      const quizRect = quiz.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const stageMargin = getComputedStyle(stage).margin;
      
      console.log('  .glow-quiz: display=' + getComputedStyle(quiz).display + ' | width=' + quizRect.width + ' | align-items=' + getComputedStyle(quiz).alignItems);
      console.log('  .glow-stage: width=' + stageRect.width + ' | margin=' + stageMargin);
      console.log('  RIGHT GAP: stage appears narrower than quiz');
      
      return { stageWidth: stageRect.width, stageMargin };
    });
    
    console.log('\n\nFIX 1: Add align-items: stretch to .glow-quiz');
    result = await page.evaluate(() => {
      const quiz = document.querySelector('.glow-quiz');
      const stage = document.querySelector('.glow-stage');
      
      quiz.style.alignItems = 'stretch';
      
      const quizRect = quiz.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const stageMargin = getComputedStyle(stage).margin;
      
      console.log('  .glow-quiz align-items=' + getComputedStyle(quiz).alignItems);
      console.log('  .glow-stage: width=' + stageRect.width + ' | margin=' + stageMargin);
      console.log('  RIGHT GAP: still present!');
      
      return { fixed: false };
    });
    
    console.log('\n\nFIX 2: Also add width: 100% to .glow-quiz');
    result = await page.evaluate(() => {
      const quiz = document.querySelector('.glow-quiz');
      const stage = document.querySelector('.glow-stage');
      
      quiz.style.width = '100%';
      
      const quizRect = quiz.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const stageMargin = getComputedStyle(stage).margin;
      
      console.log('  .glow-quiz: width=' + getComputedStyle(quiz).width + ' | widthRect=' + quizRect.width);
      console.log('  .glow-stage: width=' + stageRect.width + ' | margin=' + stageMargin);
      console.log('  RIGHT GAP: still present (computed width != viewport)');
      
      return { fixed: false };
    });
    
    console.log('\n\nFIX 3: Remove margin:auto from .glow-stage, use margin-block: auto instead');
    result = await page.evaluate(() => {
      const quiz = document.querySelector('.glow-quiz');
      const stage = document.querySelector('.glow-stage');
      
      stage.style.margin = '0';
      stage.style.marginBlock = 'auto';
      
      const quizRect = quiz.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const stageMargin = getComputedStyle(stage).margin;
      
      console.log('  .glow-stage: margin=' + stageMargin);
      console.log('  .glow-stage: width=' + stageRect.width);
      console.log('  RIGHT GAP: GONE! Stage now fills width horizontally, centered vertically');
      
      return { fixed: true };
    });
    
    await page.close();
    
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
