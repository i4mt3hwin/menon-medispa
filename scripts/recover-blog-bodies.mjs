/**
 * recover-blog-bodies.mjs
 *
 * Recovers the FULL, verbatim article body for every blog post from the live
 * Wix site (https://www.menonmedispa.com/post/<slug>) and writes clean semantic
 * HTML to src/data/blog-bodies.json, keyed by slug.
 *
 * Zero fabrication: text + images come straight from the live DOM
 * ([data-hook="post-description"]). No model summarization in the loop.
 *
 * Sanitizes the Wix Thunderbolt DOM down to: h2/h3/h4, p, ul/ol/li, blockquote,
 * strong/em, a, br, and inline images (real static.wixstatic.com URLs, unwrapped
 * from <wow-image>). Internal links are rewritten root-relative; external links
 * get target=_blank rel=noopener.
 *
 * Usage:  node scripts/recover-blog-bodies.mjs
 *         node scripts/recover-blog-bodies.mjs --verify   (diff vs local capture)
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD = resolve(__dirname, '..');
const BLOG_JSON = join(BUILD, 'src', 'data', 'blog.json');
const OUT_JSON = join(BUILD, 'src', 'data', 'blog-bodies.json');
const BASE = 'https://www.menonmedispa.com/post/';
const HOST = 'www.menonmedispa.com';

/**
 * In-page DOM -> clean HTML serializer. Runs inside the browser via evaluate.
 * Defined as a string-passable function; `host` is the site host for link rewriting.
 */
function extractBodyInPage(host) {
  const root = document.querySelector('[data-hook="post-description"]');
  if (!root) return null;

  const esc = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Pull the real image URL out of a (possibly lazy / wow-image-wrapped) <img>.
  const imgUrl = (img) => {
    let u =
      img.currentSrc ||
      img.getAttribute('src') ||
      img.getAttribute('data-src') ||
      '';
    if (!u || u.startsWith('data:')) {
      // Wix sometimes stashes the source on the wrapper.
      const wrap = img.closest('wow-image,[data-hook="imageViewer"]');
      const inner = wrap && wrap.querySelector('img');
      if (inner && inner.currentSrc && !inner.currentSrc.startsWith('data:'))
        u = inner.currentSrc;
    }
    return u && !u.startsWith('data:') ? u : '';
  };

  const fixHref = (href) => {
    try {
      const url = new URL(href, location.href);
      if (url.host === host) return url.pathname + url.search + url.hash; // internal -> root-relative
      return url.href;
    } catch {
      return href;
    }
  };

  const isExternal = (href) => /^https?:\/\//i.test(href) && !href.includes(host);

  const HEAD = { h1: 'h2', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h4', h6: 'h4' };

  function inline(node) {
    let out = '';
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) {
        out += esc(n.nodeValue);
      } else if (n.nodeType === 1) {
        const t = n.tagName.toLowerCase();
        if (t === 'br') { out += '<br>'; return; }
        if (t === 'img') {
          const src = imgUrl(n);
          if (src) out += `<figure class="post-figure"><img src="${esc(src)}" alt="${esc(n.getAttribute('alt') || '')}" loading="lazy" decoding="async"></figure>`;
          return;
        }
        if (t === 'a') {
          const raw = n.getAttribute('href') || '';
          const inner = inline(n);
          if (!raw) { out += inner; return; }
          const href = fixHref(raw);
          const ext = isExternal(raw) ? ' target="_blank" rel="noopener noreferrer"' : '';
          out += `<a href="${esc(href)}"${ext}>${inner}</a>`;
          return;
        }
        // emphasis: explicit tags OR computed style on spans
        const cs = window.getComputedStyle(n);
        const bold = t === 'strong' || t === 'b' || parseInt(cs.fontWeight, 10) >= 600;
        const ital = t === 'em' || t === 'i' || cs.fontStyle === 'italic';
        let inner = inline(n);
        if (ital) inner = `<em>${inner}</em>`;
        if (bold) inner = `<strong>${inner}</strong>`;
        out += inner;
      }
    });
    return out;
  }

  const blocks = [];
  function walk(node) {
    node.childNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      const t = n.tagName.toLowerCase();
      if (t === 'script' || t === 'style' || t === 'noscript') return;

      if (HEAD[t]) {
        const txt = inline(n).trim();
        if (txt) blocks.push(`<${HEAD[t]}>${txt}</${HEAD[t]}>`);
        return;
      }
      if (t === 'p') {
        const txt = inline(n).trim();
        if (txt && txt !== '<br>') blocks.push(`<p>${txt}</p>`);
        return;
      }
      if (t === 'blockquote') {
        const txt = inline(n).trim();
        if (txt) blocks.push(`<blockquote>${txt}</blockquote>`);
        return;
      }
      if (t === 'ul' || t === 'ol') {
        const items = [];
        n.querySelectorAll(':scope > li').forEach((li) => {
          const txt = inline(li).trim();
          if (txt) items.push(`<li>${txt}</li>`);
        });
        if (items.length) blocks.push(`<${t}>${items.join('')}</${t}>`);
        return;
      }
      if (t === 'img') {
        const src = imgUrl(n);
        if (src) blocks.push(`<figure class="post-figure"><img src="${src}" alt="${(n.getAttribute('alt') || '').replace(/"/g, '&quot;')}" loading="lazy" decoding="async"></figure>`);
        return;
      }
      if (t === 'figure') {
        const img = n.querySelector('img');
        const src = img ? imgUrl(img) : '';
        const cap = n.querySelector('figcaption');
        if (src) {
          const capHtml = cap && cap.textContent.trim()
            ? `<figcaption>${cap.textContent.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;')}</figcaption>` : '';
          blocks.push(`<figure class="post-figure"><img src="${src}" alt="${(img.getAttribute('alt') || '').replace(/"/g, '&quot;')}" loading="lazy" decoding="async">${capHtml}</figure>`);
        }
        return;
      }
      // structural wrapper (div/section/span/wow-image/...) -> descend
      walk(n);
    });
  }
  walk(root);
  return blocks.join('\n');
}

async function extractFrom(page, url) {
  // Wix keeps the network busy (analytics/keepalive) so 'networkidle' never
  // fires — wait for DOM + the content selector instead.
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-hook="post-description"]', { timeout: 30000 });
  // Scroll to force lazy images to resolve their real src.
  await page.evaluate(async () => {
    await new Promise((r) => {
      let y = 0;
      const step = () => {
        window.scrollTo(0, y);
        y += 600;
        if (y < document.body.scrollHeight) setTimeout(step, 60);
        else { window.scrollTo(0, 0); setTimeout(r, 400); }
      };
      step();
    });
  });
  await page.waitForTimeout(800);
  return page.evaluate(extractBodyInPage, HOST);
}

async function main() {
  const verify = process.argv.includes('--verify');
  const posts = JSON.parse(readFileSync(BLOG_JSON, 'utf8').replace(/^﻿/, ''));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  const bodies = {};
  const report = [];
  const failed = [];

  for (const post of posts) {
    const url = BASE + post.slug;
    let html = null;
    for (let attempt = 1; attempt <= 2 && !html; attempt++) {
      try {
        html = await extractFrom(page, url);
      } catch (e) {
        if (attempt === 2) console.warn(`  ! ${post.slug}: ${e.message}`);
        else await page.waitForTimeout(1500);
      }
    }
    if (html && html.replace(/<[^>]+>/g, '').trim().length > 120) {
      bodies[post.slug] = html;
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const imgs = (html.match(/<img/g) || []).length;
      report.push({ slug: post.slug, words: text.split(' ').length, imgs });
      console.log(`  ok ${post.slug}  (${text.split(' ').length} words, ${imgs} img)`);
    } else {
      failed.push(post.slug);
      console.warn(`  -- ${post.slug}: no usable body -> excerpt+CTA fallback`);
    }
  }

  await browser.close();

  if (!verify) {
    writeFileSync(OUT_JSON, JSON.stringify(bodies, null, 2) + '\n', 'utf8');
    console.log(`\nWrote ${Object.keys(bodies).length}/${posts.length} bodies -> ${OUT_JSON}`);
  }
  if (failed.length) console.log(`Fallback (excerpt+CTA): ${failed.length} -> ${failed.join(', ')}`);
  console.log(`Total words: ${report.reduce((a, r) => a + r.words, 0)}, total images: ${report.reduce((a, r) => a + r.imgs, 0)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
