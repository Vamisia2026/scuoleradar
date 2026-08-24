/**
 * ScuoleRadar — Rende trasparente lo sfondo quasi-bianco del logo.
 * Equivalente Node dello script Python (soglia 240 su RGB).
 *
 * Uso:
 *   node scripts/make-logo-transparent.mjs <input.png> <output.png> [threshold]
 *   es. node scripts/make-logo-transparent.mjs "ScuoleRadar Logo.png" public/logo.png 240
 */
import sharp from 'sharp';

const inputPath = process.argv[2] ?? 'ScuoleRadar Logo.png';
const outputPath = process.argv[3] ?? 'public/logo.png';
const threshold = Number(process.argv[4] ?? 240);

// 1) Decodifica il PNG in RGBA grezzo (alfa forzato)
const { data, info } = await sharp(inputPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info; // channels = 4 (RGBA)
const pixels = Buffer.from(data);

// 2) Se il pixel è quasi bianco/grigio chiaro (sfondo) → alfa = 0 (trasparente)
for (let i = 0; i < pixels.length; i += channels) {
  const r = pixels[i];
  const g = pixels[i + 1];
  const b = pixels[i + 2];
  if (r > threshold && g > threshold && b > threshold) {
    pixels[i + (channels - 1)] = 0;
  }
}

// 3) Ricodifica in PNG (lo sfondo bianco diventa trasparente)
await sharp(pixels, { raw: { width, height, channels } })
  .png()
  .toFile(outputPath);

console.log(`Logo salvato con successo in trasparente: ${outputPath}`);
