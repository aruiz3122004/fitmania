// Optimiza las imágenes de /public (F3-20) y genera los íconos de la PWA.
// Uso: node tools/optimize-images.mjs
//
// - Redimensiona a un máximo de 1600 px y recomprime JPEG/PNG manteniendo nombre y
//   formato (no hay que cambiar referencias en el código).
// - Solo reemplaza el archivo si el resultado pesa menos que el original.
// - Genera public/icons/icon-192.png, icon-512.png y maskable-512.png.
import { readdir, stat, writeFile, mkdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import sharp from 'sharp';

// En Windows sharp mantiene abiertos los archivos en caché y bloquea la escritura.
sharp.cache(false);

const ROOT = new URL('../public/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const MAX = 1600;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

let saved = 0;
for await (const file of walk(join(ROOT, 'Imagenes'))) {
  const ext = extname(file).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) continue;
  const before = (await stat(file)).size;
  const input = await readFile(file);
  // Idempotente: no recomprime imágenes ya livianas y dentro del tamaño máximo
  // (recomprimir JPEG una y otra vez acumula pérdida de calidad).
  const meta = await sharp(input).metadata();
  if (before < 250 * 1024 && (meta.width || 0) <= MAX && (meta.height || 0) <= MAX) continue;
  const pipeline = sharp(input).rotate().resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true });
  const output = ext === '.png'
    ? await pipeline.png({ compressionLevel: 9, palette: true, quality: 85 }).toBuffer()
    : await pipeline.jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  if (output.length < before * 0.95) {
    await writeFile(file, output);
    saved += before - output.length;
    console.log(`${file.replace(ROOT, '')}: ${(before / 1024).toFixed(0)} KB → ${(output.length / 1024).toFixed(0)} KB`);
  }
}
console.log(`Total ahorrado: ${(saved / 1024 / 1024).toFixed(2)} MB`);

// Íconos PWA (fondo de la marca para el maskable).
const source = await readFile(join(ROOT, 'Imagenes', 'Avatares', 'FitmanNEW.png'));
await mkdir(join(ROOT, 'icons'), { recursive: true });
for (const size of [192, 512]) {
  await sharp(source).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ palette: true, compressionLevel: 9 }).toFile(join(ROOT, 'icons', `icon-${size}.png`));
}
// Maskable: el contenido dentro del 80 % central (zona segura).
const inner = await sharp(source).resize(410, 410, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#DC2626' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png({ palette: true, compressionLevel: 9 })
  .toFile(join(ROOT, 'icons', 'maskable-512.png'));
console.log('Íconos PWA generados en public/icons/');
