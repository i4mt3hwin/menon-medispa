/**
 * seo-extract.mjs — deterministic SEO fact extractor for the rendered dist/.
 * Walks every dist/**\/*.html with parse5 and emits hard facts:
 * title, meta description, canonical, robots, OG/Twitter, lang, viewport,
 * H1..H3 outline, every <img> (src/alt/loading/dims/width-height), JSON-LD types,
 * internal link count. No judgment here — just ground truth for the audit agents.
 *
 * Output: scripts/.seo-facts.json  (array, one object per page)
 * Usage:  node scripts/seo-extract.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');

// ---- tiny parse5 tree helpers ----
const tag = (n) => n.tagName;
const attrs = (n) => Object.fromEntries((n.attrs || []).map((a) => [a.name, a.value]));
const isEl = (n) => typeof n.tagName === 'string';

function* walk(node) {
  yield node;
  for (const c of node.childNodes || []) yield* walk(c);
}
function text(node) {
  let out = '';
  for (const n of walk(node)) {
    if (n.nodeName === '#text') out += n.value;
  }
  return out.replace(/\s+/g, ' ').trim();
}
function findAll(root, name) {
  const out = [];
  for (const n of walk(root)) if (isEl(n) && tag(n) === name) out.push(n);
  return out;
}

// ---- collect html files ----
function htmlFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...htmlFiles(p));
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const files = htmlFiles(DIST).sort();
const results = [];

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const doc = parse(html);

  // route path from dist layout: dist/foo/index.html -> /foo ; dist/index.html -> /
  let rel = relative(DIST, file).split(sep).join('/');
  let route = '/' + rel.replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '');
  if (route === '') route = '/';

  const head = findAll(doc, 'head')[0];
  const body = findAll(doc, 'body')[0];
  const htmlEl = findAll(doc, 'html')[0];

  // meta map
  const metas = findAll(head || doc, 'meta').map(attrs);
  const metaByName = (name) =>
    metas.find((m) => (m.name || '').toLowerCase() === name.toLowerCase())?.content ?? null;
  const metaByProp = (prop) =>
    metas.find((m) => (m.property || '').toLowerCase() === prop.toLowerCase())?.content ?? null;

  const titleEl = findAll(head || doc, 'title')[0];
  const title = titleEl ? text(titleEl) : null;

  const links = findAll(head || doc, 'link').map(attrs);
  const canonical = links.find((l) => (l.rel || '') === 'canonical')?.href ?? null;

  // headings outline (document order, h1-h6) — capture for hierarchy/skip-level analysis
  const headings = [];
  for (const n of walk(body || doc)) {
    if (isEl(n) && /^h[1-6]$/.test(tag(n))) {
      headings.push({ level: tag(n), text: text(n) });
    }
  }
  // detect skipped levels (e.g. h2 -> h4) — Lighthouse "headings not sequentially-descending"
  let prevLvl = 0;
  const skips = [];
  for (const h of headings) {
    const lvl = Number(h.level[1]);
    if (prevLvl && lvl > prevLvl + 1) skips.push(`${'h' + prevLvl} -> ${h.level} ("${h.text.slice(0, 40)}")`);
    prevLvl = lvl;
  }
  const h1s = findAll(body || doc, 'h1').map((h) => text(h));

  // images
  const imgs = findAll(body || doc, 'img').map((n) => {
    const a = attrs(n);
    return {
      src: a.src ?? a['data-src'] ?? null,
      alt: a.alt ?? null, // null = attribute absent; "" = present but empty (decorative)
      hasAltAttr: 'alt' in a,
      loading: a.loading ?? null,
      width: a.width ?? null,
      height: a.height ?? null,
      decoding: a.decoding ?? null,
    };
  });

  // <picture> with no <img> fallback would be an issue — count source-only pictures
  const pictures = findAll(body || doc, 'picture').length;

  // json-ld
  const jsonld = [];
  for (const s of findAll(head || doc, 'script')) {
    const a = attrs(s);
    if ((a.type || '') === 'application/ld+json') {
      try {
        const parsed = JSON.parse(text(s) || '{}');
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        for (const node of arr) {
          jsonld.push({ type: node['@type'] ?? null, keys: Object.keys(node) });
        }
      } catch (e) {
        jsonld.push({ type: 'PARSE_ERROR', error: String(e).slice(0, 120) });
      }
    }
  }

  // internal links
  const anchors = findAll(body || doc, 'a').map(attrs);
  const internalLinks = anchors.filter((a) => (a.href || '').startsWith('/')).length;
  const emptyAnchorText = findAll(body || doc, 'a').filter((n) => {
    const a = attrs(n);
    const hasImg = findAll(n, 'img').length > 0;
    const hasAria = a['aria-label'] || a['title'];
    return !text(n) && !hasImg && !hasAria;
  }).length;
  // non-descriptive anchor text (Lighthouse "links do not have descriptive text")
  const GENERIC = /^(click here|read more|learn more|more|here|this|see more|details|view|view more|continue|continue reading|link|go|shop now|find out more|read|tap here)$/i;
  const genericLinks = [];
  for (const n of findAll(body || doc, 'a')) {
    const a = attrs(n);
    const t = text(n);
    const label = a['aria-label'] || a['title'] || '';
    if (t && GENERIC.test(t.trim()) && !(label && !GENERIC.test(label.trim()))) {
      genericLinks.push({ text: t.trim(), href: a.href || null });
    }
  }

  results.push({
    route,
    file: rel,
    lang: htmlEl ? attrs(htmlEl).lang ?? null : null,
    viewport: metaByName('viewport'),
    title,
    titleLen: title ? title.length : 0,
    description: metaByName('description'),
    descLen: metaByName('description') ? metaByName('description').length : 0,
    canonical,
    robots: metaByName('robots'),
    ogTitle: metaByProp('og:title'),
    ogDescription: metaByProp('og:description'),
    ogImage: metaByProp('og:image'),
    ogType: metaByProp('og:type'),
    ogUrl: metaByProp('og:url'),
    twitterCard: metaByName('twitter:card'),
    twitterTitle: metaByName('twitter:title'),
    twitterImage: metaByName('twitter:image'),
    h1Count: h1s.length,
    h1: h1s,
    headingOutline: headings,
    headingSkips: skips,
    headingCounts: {
      h1: headings.filter((h) => h.level === 'h1').length,
      h2: headings.filter((h) => h.level === 'h2').length,
      h3: headings.filter((h) => h.level === 'h3').length,
      h4: headings.filter((h) => h.level === 'h4').length,
      h5: headings.filter((h) => h.level === 'h5').length,
      h6: headings.filter((h) => h.level === 'h6').length,
    },
    imgCount: imgs.length,
    imgsMissingAlt: imgs.filter((i) => !i.hasAltAttr).length,
    imgsEmptyAlt: imgs.filter((i) => i.hasAltAttr && i.alt === '').length,
    images: imgs,
    pictureCount: pictures,
    jsonld,
    internalLinks,
    emptyAnchors: emptyAnchorText,
    genericLinks,
  });
}

writeFileSync(
  join(__dirname, '.seo-facts.json'),
  JSON.stringify(results, null, 2),
);
console.log(`Extracted SEO facts for ${results.length} pages -> scripts/.seo-facts.json`);

// quick console summary of the most common mechanical issues
const noindex = results.filter((r) => /noindex/i.test(r.robots || ''));
console.log(`\nIndexable: ${results.length - noindex.length} | noindex: ${noindex.length}`);
console.log('Pages with H1 != 1:', results.filter((r) => r.h1Count !== 1).map((r) => `${r.route}(${r.h1Count})`).join(', ') || 'none');
console.log('Titles >60 chars:', results.filter((r) => r.titleLen > 60).length);
console.log('Titles <30 chars:', results.filter((r) => r.titleLen > 0 && r.titleLen < 30).length);
console.log('Desc >160 chars:', results.filter((r) => r.descLen > 160).length);
console.log('Desc <120 chars:', results.filter((r) => r.descLen > 0 && r.descLen < 120).length);
console.log('Missing desc:', results.filter((r) => !r.description).length);
console.log('Total imgs missing alt attr:', results.reduce((s, r) => s + r.imgsMissingAlt, 0));
