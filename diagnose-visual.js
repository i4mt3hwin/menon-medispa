import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4326';
const baseDir = '/tmp/glow-diagnostic';

async function run() {
  const browser = await chromium.launch({ headless: true });
  
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    
    console.log('VISUAL INSPECTION: Is the right gap actually a rendering gap or margin issue?\n');
    
    await page.goto(BASE_URL + '/find-your-glow');
    await page.waitForSelector('#glow-begin', { timeout: 5000 });
    await page.click('#glow-begin');
    await page.waitForTimeout(700);
    await page.evaluate(() => { document.documentElement.style.zoom = '0.4'; });
    await page.waitForTimeout(300);
    
    console.log('Measuring right edge of elements:');
    const edges = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      const quiz = document.querySelector('.glow-quiz');
      const stage = document.querySelector('.glow-stage');
      const step = document.querySelector('.glow-step.is-active');
      
      return {
        viewport: window.innerWidth,
        htmlRight: html.getBoundingClientRect().right,
        bodyRight: body.getBoundingClientRect().right,
        quizRight: quiz.getBoundingClientRect().right,
        stageRight: stage.getBoundingClientRect().right,
        stepRight: step.getBoundingClientRect().right,
        stageMarginRight: parseFloat(getComputedStyle(stage).marginRight),
      };
    });
    
    console.log('\nRIGHT EDGES:');
    console.log('  viewport width: ' + edges.viewport);
    console.log('  html right: ' + edges.htmlRight);
    console.log('  body right: ' + edges.bodyRight);
    console.log('  quiz right: ' + edges.quizRight);
    console.log('  stage right: ' + edges.stageRight);
    console.log('  step right: ' + edges.stepRight);
    
    console.log('\nGAP ANALYSIS:');
    console.log('  viewport to quiz: ' + (edges.viewport - edges.quizRight) + 'px');
    console.log('  viewport to stage: ' + (edges.viewport - edges.stageRight) + 'px');
    console.log('  viewport to step: ' + (edges.viewport - edges.stepRight) + 'px');
    console.log('  stage marginRight: ' + edges.stageMarginRight + 'px');
    
    // Screenshot with annotations
    await page.screenshot({ path: baseDir + '/visual-check-zoom-0.4.png' });
    
    // Now overlay a visual debug
    await page.evaluate(() => {
      const stage = document.querySelector('.glow-stage');
      stage.style.border = '2px solid red';
      stage.style.background = 'rgba(255,0,0,0.1)';
      
      const quiz = document.querySelector('.glow-quiz');
      quiz.style.border = '2px solid blue';
    });
    await page.screenshot({ path: baseDir + '/visual-check-with-borders.png' });
    
    await page.close();
    
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
