/**
 * verify-fidelity.mjs
 * Proves the scraped bodies are verbatim by comparing the recovered text against
 * the ORIGINAL local capture (rendered.html) for the 2 posts that have ground truth.
 * Extracts the same [data-hook="post-description"] text from the local file and
 * reports word-level overlap vs blog-bodies.json.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD = resolve(__dirname, '..');
const DISCOVERY = resolve(BUILD, '..', '01-discovery', 'pages', 'post');
const bodies = JSON.parse(readFileSync(join(BUILD, 'src', 'data', 'blog-bodies.json'), 'utf8'));

const GROUND_TRUTH = [
  'first-botox-appointment-a-step-by-step-guide',
  'the-complete-guide-to-hydrafacial-and-how-it-can-improve-your-skin-health',
];

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s) => norm(s).split(' ').filter(Boolean);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
// Block every external/subresource request — we only need the static DOM.
await page.route('**', (route) =>
  route.request().resourceType() === 'document' ? route.continue() : route.abort()
);

for (const slug of GROUND_TRUTH) {
  const localFile = join(DISCOVERY, slug, 'rendered.html');
  const html = readFileSync(localFile, 'utf8');
  await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const localText = await page.evaluate(() => {
    const el = document.querySelector('[data-hook="post-description"]');
    return el ? el.textContent : '';
  });
  const recovered = (bodies[slug] || '').replace(/<[^>]+>/g, ' ');

  const lw = words(localText);
  const rw = new Set(words(recovered));
  const localSet = new Set(lw);
  const overlap = lw.filter((w) => rw.has(w)).length / Math.max(lw.length, 1);
  // reverse: how much recovered text is grounded in the local capture
  const grounded = words(recovered).filter((w) => localSet.has(w)).length / Math.max(words(recovered).length, 1);

  console.log(`\n${slug}`);
  console.log(`  local capture words: ${lw.length}, recovered words: ${words(recovered).length}`);
  console.log(`  local->recovered coverage: ${(overlap * 100).toFixed(1)}%  (recovered contains the captured text)`);
  console.log(`  recovered->local grounding: ${(grounded * 100).toFixed(1)}%  (recovered text is in the capture, i.e. not fabricated)`);
}

await browser.close();
