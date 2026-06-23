import { chromium } from 'playwright';
import fs from 'fs';

const BASE_URL = 'http://localhost:4326';
const baseDir = '/tmp/glow-diagnostic';

if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

async function captureMetrics(page, label) {
  console.log(`\n========== ${label} ==========`);
  
  const metrics = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const quiz = document.querySelector('.glow-quiz');
    const stage = document.querySelector('.glow-stage');
    const step = document.querySelector('.glow-step.is-active');
    
    const getBounds = (el) => el ? {
      left: el.getBoundingClientRect().left,
      right: el.getBoundingClientRect().right,
      width: el.getBoundingClientRect().width,
    } : null;
    
    return {
      innerWidth: window.innerWidth,
      scrollWidth: html.scrollWidth,
      hasHorizontalOverflow: html.scrollWidth > window.innerWidth,
      overflowAmount: html.scrollWidth - window.innerWidth,
      html: getBounds(html),
      body: getBounds(body),
      quiz: getBounds(quiz),
      stage: getBounds(stage),
      step: getBounds(step),
      quizDisplay: quiz ? getComputedStyle(quiz).display : null,
      quizComputedWidth: quiz ? getComputedStyle(quiz).width : null,
      stageMaxWidth: stage ? getComputedStyle(stage).maxWidth : null,
      stageMargin: stage ? getComputedStyle(stage).margin : null,
    };
  });
  
  console.log('Window: innerWidth=' + metrics.innerWidth + ' | scrollWidth=' + metrics.scrollWidth + ' | overflow=' + metrics.hasHorizontalOverflow + ' | amount=' + metrics.overflowAmount);
  console.log('HTML: [' + Math.round(metrics.html.left) + ', ' + Math.round(metrics.html.right) + ', width=' + Math.round(metrics.html.width) + ']');
  console.log('BODY: [' + Math.round(metrics.body.left) + ', ' + Math.round(metrics.body.right) + ', width=' + Math.round(metrics.body.width) + ']');
  console.log('QUIZ: [' + Math.round(metrics.quiz.left) + ', ' + Math.round(metrics.quiz.right) + ', width=' + Math.round(metrics.quiz.width) + ']');
  console.log('  display=' + metrics.quizDisplay + ' | computed-width=' + metrics.quizComputedWidth);
  console.log('STAGE: [' + Math.round(metrics.stage.left) + ', ' + Math.round(metrics.stage.right) + ', width=' + Math.round(metrics.stage.width) + ']');
  console.log('  max-width=' + metrics.stageMaxWidth + ' | margin=' + metrics.stageMargin);
  console.log('STEP: width=' + Math.round(metrics.step.width));
  
  const rightGap = metrics.innerWidth - metrics.quiz.width;
  console.log('RIGHT GAP (innerWidth - quiz.width): ' + Math.round(rightGap) + 'px');
  
  return metrics;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  
  try {
    // Test 1: Large viewport (2400x1200)
    const page1 = await browser.newPage({ viewport: { width: 2400, height: 1200 } });
    console.log('\n\nTEST 1: LARGE VIEWPORT (2400x1200)');
    await page1.goto(BASE_URL + '/find-your-glow');
    await page1.waitForSelector('#glow-begin', { timeout: 5000 });
    await page1.click('#glow-begin');
    await page1.waitForTimeout(700);
    
    await captureMetrics(page1, 'LARGE VIEWPORT');
    await page1.screenshot({ path: baseDir + '/test1-large-viewport.png' });
    await page1.close();
    
    // Test 2: Normal viewport with zoom 0.4
    const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    console.log('\n\nTEST 2: ZOOM 0.4 (1440x900)');
    await page2.goto(BASE_URL + '/find-your-glow');
    await page2.waitForSelector('#glow-begin', { timeout: 5000 });
    await page2.click('#glow-begin');
    await page2.waitForTimeout(700);
    await page2.evaluate(() => { document.documentElement.style.zoom = '0.4'; });
    await page2.waitForTimeout(300);
    
    await captureMetrics(page2, 'ZOOM 0.4');
    await page2.screenshot({ path: baseDir + '/test2-zoom-0.4.png' });
    
    console.log('\n--- NOW TOGGLING CSS ---');
    await page2.evaluate(() => {
      document.querySelector('.glow-quiz').style.display = 'block';
    });
    await page2.waitForTimeout(300);
    
    await captureMetrics(page2, 'AFTER display:block');
    await page2.screenshot({ path: baseDir + '/test2-after-display-block.png' });
    await page2.close();
    
    console.log('\n\nDIAGNOSTIC COMPLETE');
    console.log('Screenshots: ' + baseDir);
    
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
