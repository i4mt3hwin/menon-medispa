/**
 * seo-og-card.mjs — generate the default 1200x630 Open Graph share card.
 * White (tinted) Menon logo on the brand plum, with a gold rule + caps line.
 * Output: public/og/default.png  (+ a smaller .jpg for reference)
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const W = 1200, H = 630;
const PLUM = '#584B63';
const PLUM_DK = '#3f3548';
const GOLD = '#C4A484';
const CREAM = '#EFE7DF';
const LOGO = 'public/images/medispa-logo-horizontal.png';

// 1) make a WHITE version of the dark logo (use its alpha as a mask over white)
const meta = await sharp(LOGO).metadata();
const alpha = await sharp(LOGO).ensureAlpha().extractChannel(3).toColourspace('b-w').toBuffer();
const whiteLogoFull = await sharp({
  create: { width: meta.width, height: meta.height, channels: 3, background: '#ffffff' },
})
  .joinChannel(alpha)
  .png()
  .toBuffer();

// scale logo
const logoW = 580;
const logoH = Math.round(logoW * (meta.height / meta.width));
const whiteLogo = await sharp(whiteLogoFull).resize(logoW, logoH).png().toBuffer();
const logoX = Math.round((W - logoW) / 2);
const logoY = 196;

// 2) background SVG: plum radial glow + subtle gold frame + caps line
const ruleY = logoY + logoH + 56;
const textY = ruleY + 56;
const bg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="40%" r="75%">
      <stop offset="0%" stop-color="#6a5c75"/>
      <stop offset="60%" stop-color="${PLUM}"/>
      <stop offset="100%" stop-color="${PLUM_DK}"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="28" y="28" width="${W - 56}" height="${H - 56}" rx="6"
        fill="none" stroke="${GOLD}" stroke-opacity="0.45" stroke-width="2"/>
  <line x1="${W / 2 - 70}" y1="${ruleY}" x2="${W / 2 + 70}" y2="${ruleY}"
        stroke="${GOLD}" stroke-width="2"/>
  <text x="${W / 2}" y="${textY}" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-size="30"
        letter-spacing="6" fill="${CREAM}">MEDICAL SPA &#183; MILLBURN, NEW JERSEY</text>
</svg>`;

mkdirSync('public/og', { recursive: true });
const png = await sharp(Buffer.from(bg))
  .composite([{ input: whiteLogo, left: logoX, top: logoY }])
  .png({ quality: 90 })
  .toBuffer();
writeFileSync('public/og/default.png', png);
console.log('Wrote public/og/default.png', (png.length / 1024).toFixed(0) + 'KB', `${W}x${H}`);
