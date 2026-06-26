#!/usr/bin/env node
import { readdir, stat, copyFile, access, mkdir } from "node:fs/promises";
import { join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const IMAGES_DIR = join(__dirname, "..", "public", "images");
const ORIGINALS_DIR = join(__dirname, "..", "..", "images-originals");

const MIN_SIZE_BYTES = 15 * 1024;
const LARGE_SIZE_BYTES = 1024 * 1024;
const MAX_WIDTH = 2000;
const AVIF_QUALITY = 55;
const WEBP_QUALITY = 78;
const PNG_QUALITY = 85;
const JPEG_QUALITY = 82;

const exists = async (p) => {
  try { await access(p); return true; } catch { return false; }
};

const isOutputNewerThanSource = async (sourcePath, outputPath) => {
  if (!(await exists(outputPath))) return false;
  const [s, o] = await Promise.all([stat(sourcePath), stat(outputPath)]);
  return o.mtimeMs >= s.mtimeMs;
};

const humanSize = (n) => `${(n / 1024).toFixed(1)} KB`;

const processOne = async (filePath) => {
  const { dir, name, ext } = parse(filePath);
  const extLower = ext.toLowerCase();
  if (![".png", ".jpg", ".jpeg"].includes(extLower)) return;
  if (name.endsWith(".orig")) return;

  const sourceStat = await stat(filePath);
  if (sourceStat.size < MIN_SIZE_BYTES) return;

  // Use the high-quality original (if a backup exists) as the encoding source
  // for AVIF/WebP, so subsequent runs don't degrade quality.
  await mkdir(ORIGINALS_DIR, { recursive: true });
  const backupPath = join(ORIGINALS_DIR, `${name}${ext}`);
  const encodeSource = (await exists(backupPath)) ? backupPath : filePath;

  const meta = await sharp(encodeSource).metadata();
  const sourceWidth = meta.width ?? MAX_WIDTH;
  const targetWidth = Math.min(sourceWidth, MAX_WIDTH);
  const needsResize = sourceWidth > MAX_WIDTH;

  const avifPath = join(dir, `${name}.avif`);
  const webpPath = join(dir, `${name}.webp`);

  const tasks = [];

  if (!(await isOutputNewerThanSource(encodeSource, avifPath))) {
    tasks.push(
      sharp(encodeSource)
        .resize({ width: targetWidth, withoutEnlargement: true })
        .avif({ quality: AVIF_QUALITY, effort: 6 })
        .toFile(avifPath)
        .then((info) => console.log(`  → ${name}.avif (${humanSize(info.size)})`))
    );
  }

  if (!(await isOutputNewerThanSource(encodeSource, webpPath))) {
    tasks.push(
      sharp(encodeSource)
        .resize({ width: targetWidth, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY, effort: 6 })
        .toFile(webpPath)
        .then((info) => console.log(`  → ${name}.webp (${humanSize(info.size)})`))
    );
  }

  if (sourceStat.size >= LARGE_SIZE_BYTES) {
    if (!(await exists(backupPath))) {
      await copyFile(filePath, backupPath);
      console.log(`  ↳ backed up original → images-originals/${name}${ext}`);
    }
    const tmpPath = join(dir, `${name}.tmp${ext}`);
    sharp.cache(false);
    const pipeline = sharp(backupPath).resize({ width: targetWidth, withoutEnlargement: true });
    const finalPipeline = extLower === ".png"
      ? pipeline.png({ compressionLevel: 9, palette: true, quality: PNG_QUALITY })
      : pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
    tasks.push(
      finalPipeline.toFile(tmpPath).then(async (info) => {
        const { rename } = await import("node:fs/promises");
        await rename(tmpPath, filePath);
        console.log(`  ↻ recompressed ${name}${ext} (${humanSize(sourceStat.size)} → ${humanSize(info.size)})`);
      })
    );
  }

  if (tasks.length === 0) {
    return;
  }
  console.log(`◆ ${name}${ext} (${humanSize(sourceStat.size)}, ${sourceWidth}px → ${targetWidth}px${needsResize ? " resized" : ""})`);
  await Promise.all(tasks);
};

const main = async () => {
  const entries = await readdir(IMAGES_DIR);
  const files = entries.map((e) => join(IMAGES_DIR, e));
  let processed = 0;
  for (const file of files) {
    const s = await stat(file);
    if (!s.isFile()) continue;
    try {
      await processOne(file);
      processed++;
    } catch (err) {
      console.error(`✗ Failed to process ${file}: ${err.message}`);
    }
  }
  console.log(`\nDone. Scanned ${processed} files in ${IMAGES_DIR}.`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
