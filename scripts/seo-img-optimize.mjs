/**
 * seo-img-optimize.mjs — shrink oversized source images to display-appropriate sizes
 * (2026-06-22 SEO/CWV pass). Originals are backed up to scripts/.img-backup/ first
 * (also recoverable via git). Re-encodes in place so every existing reference — raw
 * <img src={x.src}> AND Astro <Image> — ships the smaller file with no component edits.
 *
 * Run: node scripts/seo-img-optimize.mjs
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, statSync } from 'node:fs';
import { basename } from 'node:path';

const BK = 'scripts/.img-backup';
mkdirSync(BK, { recursive: true });
const kb = (n) => (n / 1024).toFixed(0) + 'KB';

// Source assets: [path, maxLongEdge, encoder]. Tiles/cards display <=~700px, the
// office-staff CTA <=~1240px, the blurred bg can be soft.
const ASSETS = [
  ['src/assets/services/face-treatments.webp', 1200, { webp: { quality: 72 } }],
  ['src/assets/services/natural-beauty-body.webp', 1200, { webp: { quality: 72 } }],
  ['src/assets/services/model-curly-hair.webp', 1200, { webp: { quality: 72 } }],
  ['src/assets/services/botox-injectables-card.webp', 1100, { webp: { quality: 72 } }],
  ['src/assets/services/juvederm-fillers-card.webp', 1100, { webp: { quality: 72 } }],
  ['src/assets/services/hydrafacial-keravive-card.jpeg', 1100, { jpeg: { quality: 72, mozjpeg: true } }],
  ['src/assets/images/b1a819f35921.webp', 1400, { webp: { quality: 72 } }],
  ['src/assets/home/your-skin-comes-first-bg.webp', 1600, { webp: { quality: 55 } }], // blurred bg
];

let saved = 0;
for (const [path, maxEdge, enc] of ASSETS) {
  if (!existsSync(path)) { console.log('SKIP (missing):', path); continue; }
  const before = statSync(path).size;
  const bkPath = `${BK}/${basename(path)}`;
  if (!existsSync(bkPath)) copyFileSync(path, bkPath); // back up original once
  const input = readFileSync(bkPath); // always re-encode from the pristine backup
  const fmt = Object.keys(enc)[0];
  const out = await sharp(input)
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .toFormat(fmt, enc[fmt])
    .toBuffer();
  writeFileSync(path, out);
  saved += before - out.length;
  console.log(`${basename(path).padEnd(34)} ${kb(before).padStart(7)} -> ${kb(out.length).padStart(7)}`);
}

// Avatars: 240x240 ~100KB PNGs displayed at <=77px. Make real 144x144 WebP.
// Public copies (referenced as /images/<key>.png across hero + service s1-heros) AND
// the asset copies (reviewer-avatar-*.webp, used raw in home section 7).
const AV = [
  ['public/images/90411e0041df.png', 'public/images/90411e0041df.webp'],
  ['public/images/305afeda5f9a.png', 'public/images/305afeda5f9a.webp'],
  ['public/images/b95880091b44.png', 'public/images/b95880091b44.webp'],
  ['src/assets/testimonials/reviewer-avatar-1.webp', 'src/assets/testimonials/reviewer-avatar-1.webp'],
  ['src/assets/testimonials/reviewer-avatar-2.webp', 'src/assets/testimonials/reviewer-avatar-2.webp'],
  ['src/assets/testimonials/reviewer-avatar-3.webp', 'src/assets/testimonials/reviewer-avatar-3.webp'],
];
for (const [src, dst] of AV) {
  if (!existsSync(src)) { console.log('SKIP avatar (missing):', src); continue; }
  const before = statSync(src).size;
  const bkPath = `${BK}/${basename(src)}.bak`;
  if (!existsSync(bkPath)) copyFileSync(src, bkPath);
  const out = await sharp(readFileSync(bkPath))
    .resize(144, 144, { fit: 'cover' })
    .webp({ quality: 78 })
    .toBuffer();
  writeFileSync(dst, out);
  saved += before - out.length;
  console.log(`${basename(dst).padEnd(34)} ${kb(before).padStart(7)} -> ${kb(out.length).padStart(7)}`);
}

console.log(`\nTotal source bytes saved: ${kb(saved)}`);
