/**
 * _optimize-images.mjs — one-time, safe, in-place image downscale + recompress.
 * Keeps each file's name + format (so imports/refs don't break). Backs up the
 * pristine original to _img-backup/<relpath> before first modification (reversible).
 * WebP + responsive srcset come later via Astro <Image> during the redesign sweep.
 */
import sharp from 'sharp';
import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const ROOTS = ['src/assets', 'public'];
const BACKUP = '_img-backup';
const MAX_DIM = 2000;            // longest side
const SKIP_UNDER = 200 * 1024;   // leave small files alone unless oversized dims
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else {
      const lower = name.toLowerCase();
      const dot = lower.lastIndexOf('.');
      if (dot > -1 && exts.has(lower.slice(dot))) out.push(p);
    }
  }
  return out;
}

const files = ROOTS.flatMap((r) => walk(r));
let before = 0, after = 0, changed = 0, skipped = 0;
const big = [];

for (const f of files) {
  const origSize = statSync(f).size;
  before += origSize;
  let meta;
  try { meta = await sharp(f).metadata(); } catch { skipped++; after += origSize; continue; }
  const longest = Math.max(meta.width || 0, meta.height || 0);
  const needsResize = longest > MAX_DIM;
  if (!needsResize && origSize < SKIP_UNDER) { skipped++; after += origSize; continue; }

  // Backup pristine original once
  const bpath = join(BACKUP, relative('.', f));
  if (!existsSync(bpath)) { mkdirSync(dirname(bpath), { recursive: true }); copyFileSync(f, bpath); }

  const ext = f.toLowerCase().slice(f.toLowerCase().lastIndexOf('.'));
  let pipe = sharp(bpath, { animated: ext === '.webp' });   // read from backup (pristine)
  if (needsResize) pipe = pipe.resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true });
  if (ext === '.png') pipe = pipe.png({ compressionLevel: 9, effort: 8, palette: true, quality: 90 });
  else if (ext === '.webp') pipe = pipe.webp({ quality: 80 });
  else pipe = pipe.jpeg({ quality: 80, mozjpeg: true });

  const buf = await pipe.toBuffer();
  // Only overwrite if we actually saved bytes; else keep original
  if (buf.length < origSize) {
    writeFileSync(f, buf);
    after += buf.length;
    changed++;
    if (origSize - buf.length > 1024 * 1024) big.push([f, origSize, buf.length]);
  } else {
    after += origSize;
    skipped++;
  }
}

big.sort((a, b) => (b[1] - b[2]) - (a[1] - a[2]));
console.log('Biggest reductions:');
for (const [f, o, n] of big.slice(0, 15)) {
  console.log(`  ${(o/1024/1024).toFixed(1)}MB -> ${(n/1024).toFixed(0)}KB   ${f}`);
}
console.log(`\nfiles: ${files.length}  changed: ${changed}  skipped: ${skipped}`);
console.log(`total: ${(before/1024/1024).toFixed(1)} MB -> ${(after/1024/1024).toFixed(1)} MB`);
