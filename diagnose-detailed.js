import { chromium } from 'playwright';
import fs from 'fs';

const BASE_URL = 'http://localhost:4326';
const baseDir = '/tmp/glow-diagnostic';

async function run() {
  const browser = await chromium.launch({ headless: true });
  
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    
    console.log('\nZOOM 0.4 - DETAILED ANALYSIS');
    
    await page.goto(BASE_URL + '/find-your-glow');
    await page.waitForSelector('#glow-begin', { timeout: 5000 });
    await page.click('#glow-begin');
    await page.waitForTimeout(700);
    await page.evaluate(() => { document.documentElement.style.zoom = '0.4'; });
    await page.waitForTimeout(300);
    
    // Detailed metrics
    const details = await page.evaluate(() => {
      const html = document.documentElement;
      const quiz = document.querySelector('.glow-quiz');
      const stage = document.querySelector('.glow-stage');
      
      const getFullInfo = (el, name) => {
        const rect = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        console.log(`\n${name}:`);
        console.log(`  getBoundingClientRect: left=${rect.left} right=${rect.right} width=${rect.width}`);
        console.log(`  computed width: ${cs.width}`);
        console.log(`  computed max-width: ${cs.maxWidth}`);
        console.log(`  computed margin: ${cs.margin}`);
        console.log(`  computed display: ${cs.display}`);
        console.log(`  computed flex-direction: ${cs.flexDirection}`);
        console.log(`  computed align-items: ${cs.alignItems}`);
        console.log(`  computed justify-content: ${cs.justifyContent}`);
        
        return {
          name,
          boundingRect: { left: rect.left, right: rect.right, width: rect.width },
          computed: {
            width: cs.width,
            maxWidth: cs.maxWidth,
            margin: cs.margin,
            display: cs.display,
            flexDirection: cs.flexDirection,
            alignItems: cs.alignItems,
            justifyContent: cs.justifyContent,
          }
        };
      };
      
      return {
        viewport: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          scrollWidth: html.scrollWidth,
          scrollHeight: html.scrollHeight,
        },
        html: getFullInfo(html, 'HTML'),
        body: getFullInfo(document.body, 'BODY'),
        quiz: getFullInfo(quiz, 'GLOW-QUIZ (flex column main)'),
        stage: getFullInfo(stage, 'GLOW-STAGE (max-width: 880px)'),
      };
    });
    
    console.log('\n========== SUMMARY ==========');
    console.log('Viewport innerWidth: ' + details.viewport.innerWidth);
    console.log('QUIZ getBoundingClientRect width: ' + details.quiz.boundingRect.width);
    console.log('QUIZ computed width: ' + details.quiz.computed.width);
    console.log('QUIZ display: ' + details.quiz.computed.display);
    console.log('QUIZ align-items: ' + details.quiz.computed.alignItems);
    console.log('\nSTAGE getBoundingClientRect width: ' + details.stage.boundingRect.width);
    console.log('STAGE computed width: ' + details.stage.computed.width);
    console.log('STAGE max-width: ' + details.stage.computed.maxWidth);
    console.log('STAGE margin: ' + details.stage.computed.margin);
    
    console.log('\n========== NOW TESTING FIXES ==========');
    
    // Try 1: width: 100%
    console.log('\nTRY 1: Set .glow-quiz width = "100%"');
    const result1 = await page.evaluate(() => {
      const quiz = document.querySelector('.glow-quiz');
      quiz.style.width = '100%';
      const rect = quiz.getBoundingClientRect();
      return {
        boundingWidth: rect.width,
        computed: getComputedStyle(quiz).width,
      };
    });
    console.log('  Result: boundingWidth=' + result1.boundingWidth + ' computed=' + result1.computed);
    
    // Try 2: align-items: stretch
    console.log('\nTRY 2: Also set .glow-quiz align-items = "stretch"');
    const result2 = await page.evaluate(() => {
      const quiz = document.querySelector('.glow-quiz');
      quiz.style.alignItems = 'stretch';
      const rect = quiz.getBoundingClientRect();
      return {
        boundingWidth: rect.width,
        alignItems: getComputedStyle(quiz).alignItems,
      };
    });
    console.log('  Result: boundingWidth=' + result2.boundingWidth + ' align-items=' + result2.alignItems);
    
    // Try 3: Remove margin auto on stage
    console.log('\nTRY 3: Remove margin auto from .glow-stage (revert to margin: 0)');
    const result3 = await page.evaluate(() => {
      const quiz = document.querySelector('.glow-quiz');
      const stage = document.querySelector('.glow-stage');
      quiz.style.width = '';
      quiz.style.alignItems = '';
      stage.style.margin = '0';
      const rect = quiz.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      return {
        quizBoundingWidth: rect.width,
        stageBoundingWidth: stageRect.width,
      };
    });
    console.log('  Result: quiz width=' + result3.quizBoundingWidth + ' stage width=' + result3.stageBoundingWidth);
    
    await page.close();
    
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
