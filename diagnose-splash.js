import { chromium } from 'playwright';
import fs from 'fs';

const BASE_URL = 'http://localhost:4326';
const baseDir = '/tmp/glow-diagnostic';

async function captureMetrics(page, label) {
  console.log(`\n========== ${label} ==========`);
  
  const metrics = await page.evaluate(() => {
    const html = document.documentElement;
    const quiz = document.querySelector('.glow-quiz');
    
    const getBounds = (el) => el ? {
      left: el.getBoundingClientRect().left,
      right: el.getBoundingClientRect().right,
      width: el.getBoundingClientRect().width,
    } : null;
    
    return {
      innerWidth: window.innerWidth,
      scrollWidth: html.scrollWidth,
      hasHorizontalOverflow: html.scrollWidth > window.innerWidth,
      quiz: getBounds(quiz),
      quizDisplay: quiz ? getComputedStyle(quiz).display : null,
      quizComputedWidth: quiz ? getComputedStyle(quiz).width : null,
    };
  });
  
  console.log('Window: innerWidth=' + metrics.innerWidth + ' | scrollWidth=' + metrics.scrollWidth + ' | overflow=' + metrics.hasHorizontalOverflow);
  console.log('QUIZ: [' + Math.round(metrics.quiz.left) + ', ' + Math.round(metrics.quiz.right) + ', width=' + Math.round(metrics.quiz.width) + ']');
  console.log('  display=' + metrics.quizDisplay + ' | computed-width=' + metrics.quizComputedWidth);
  
  const rightGap = metrics.innerWidth - metrics.quiz.width;
  console.log('RIGHT GAP: ' + Math.round(rightGap) + 'px');
  
  return metrics;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  
  try {
    // Splash: Large viewport
    const page1 = await browser.newPage({ viewport: { width: 2400, height: 1200 } });
    console.log('\n\nTEST: SPLASH SCREEN - Large viewport (2400x1200)');
    await page1.goto(BASE_URL + '/find-your-glow');
    await page1.waitForSelector('#glow-hero', { timeout: 5000 });
    await page1.waitForTimeout(700);
    
    await captureMetrics(page1, 'SPLASH - LARGE');
    await page1.screenshot({ path: baseDir + '/test-splash-large.png' });
    await page1.close();
    
    // Splash: Zoom 0.4
    const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    console.log('\n\nTEST: SPLASH SCREEN - Zoom 0.4 (1440x900)');
    await page2.goto(BASE_URL + '/find-your-glow');
    await page2.waitForSelector('#glow-hero', { timeout: 5000 });
    await page2.evaluate(() => { document.documentElement.style.zoom = '0.4'; });
    await page2.waitForTimeout(300);
    
    await captureMetrics(page2, 'SPLASH - ZOOM 0.4');
    await page2.screenshot({ path: baseDir + '/test-splash-zoom-0.4.png' });
    await page2.close();
    
    console.log('\n\nDONE');
    
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
