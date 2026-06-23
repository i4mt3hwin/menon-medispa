/**
 * seo-webp-refs.mjs — rewrite image references from .png to .webp, but ONLY for keys
 * that actually have a generated .webp sibling (so favicons / OG logo / header logo,
 * which were excluded from conversion, are left as .png). Scans src + public for
 * /images/<key>.png and @/assets/images/<key>.png in astro/ts/tsx/json/css.
 *
 * Run: node scripts/seo-png-to-webp.mjs first, then this.
 */
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

// keys that have a .webp sibling (only these get their refs rewritten)
const webpKeys = new Set();
for (const dir of ['public/images', 'src/assets/images']) {
  if (!existsSync(dir)) continue;
  for (const n of readdirSync(dir)) if (n.endsWith('.webp')) webpKeys.add(n.replace(/\.webp$/, ''));
}

const EXT = new Set(['.astro', '.ts', '.tsx', '.js', '.mjs', '.json', '.css', '.md']);
function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) { if (!/node_modules|dist|\.git/.test(p)) walk(p, out); }
    else if (EXT.has(extname(n)) && !n.startsWith('.seo-')) out.push(p);
  }
  return out;
}

// match (/images/ | @/assets/images/ | assets/images/) <key> .png
const RE = /((?:\/images\/|@\/assets\/images\/|assets\/images\/))([A-Za-z0-9_-]+)\.png/g;
let files = 0, refs = 0;
const skipped = new Set();
for (const f of walk('src').concat(['scripts/seo-png-to-webp.mjs'].filter(() => false))) {
  let s = readFileSync(f, 'utf8');
  const orig = s;
  s = s.replace(RE, (m, pre, key) => {
    if (webpKeys.has(key)) { refs++; return `${pre}${key}.webp`; }
    skipped.add(key); return m;
  });
  if (s !== orig) { writeFileSync(f, s); files++; }
}
console.log(`Rewrote ${refs} refs across ${files} files.`);
if (skipped.size) console.log('Left as .png (no webp / excluded):', [...skipped].join(', '));
