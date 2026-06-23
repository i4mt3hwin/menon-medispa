/**
 * seo-png-to-webp.mjs — convert content PNGs to WebP (2026-06-22 CWV pass).
 * Generates a .webp sibling for every PNG in public/images/ and src/assets/images/
 * EXCEPT favicons, the OG logo, and the header logo (which need to stay PNG / are
 * already optimized by Astro). Photos re-encode q75; the 3 review avatars resize to
 * 144px. Originals are left on disk; reference rewrite + cleanup happen in follow-up
 * steps. Also fixes the HydraFacial Keravive card (was missed — it's .webp not .jpeg).
 *
 * Run: node scripts/seo-png-to-webp.mjs
 */
import sharp from 'sharp';
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const EXCLUDE = new Set([
  'favicon-16', 'favicon-32', 'favicon', 'apple-touch-icon',
  'medispa-logo-horizontal', // OG default image — keep PNG (OG prefers png/jpg)
  '02a84c58deec',            // header logo raster — Astro <Image> already webp-encodes it
]);
const AVATAR = new Set(['90411e0041df', '305afeda5f9a', 'b95880091b44']);
const kb = (n) => (n / 1024).toFixed(0) + 'KB';

async function convertDir(dir) {
  if (!existsSync(dir)) return { count: 0, before: 0, after: 0 };
  let count = 0, before = 0, after = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.png')) continue;
    const key = name.replace(/\.png$/, '');
    if (EXCLUDE.has(key)) continue;
    const png = join(dir, name);
    const webp = join(dir, key + '.webp');
    const b = statSync(png).size;
    let pipe = sharp(readFileSync(png));
    if (AVATAR.has(key)) pipe = pipe.resize(144, 144, { fit: 'cover' });
    else pipe = pipe.resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true });
    const out = await pipe.webp({ quality: 75 }).toBuffer();
    writeFileSync(webp, out);
    count++; before += b; after += out.length;
  }
  return { count, before, after };
}

// Keravive card fix (its source is .webp; resize it like the other service cards)
const KER = 'src/assets/services/hydrafacial-keravive-card.webp';
if (existsSync(KER)) {
  const b = statSync(KER).size;
  const out = await sharp(readFileSync(KER))
    .resize({ width: 1100, height: 1100, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72 }).toBuffer();
  writeFileSync(KER, out);
  console.log(`hydrafacial-keravive-card.webp ${kb(b)} -> ${kb(out.length)}`);
}

const pub = await convertDir('public/images');
const asset = await convertDir('src/assets/images');
console.log(`\npublic/images: ${pub.count} PNGs -> webp  (${kb(pub.before)} -> ${kb(pub.after)})`);
console.log(`src/assets/images: ${asset.count} PNGs -> webp  (${kb(asset.before)} -> ${kb(asset.after)})`);
console.log(`\nGenerated ${pub.count + asset.count} .webp siblings. Next: rewrite refs, build, delete dead public PNGs.`);
