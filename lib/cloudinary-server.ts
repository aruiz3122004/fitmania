import { createHash } from 'node:crypto';

/**
 * Borra un archivo de Cloudinary desde el servidor (F1-25). Requiere
 * CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET; si faltan, no hace nada (devuelve false).
 */
export async function deleteCloudinaryAsset(publicId: string | null | undefined, resourceType: 'image' | 'video' = 'image'): Promise<boolean> {
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!publicId || !apiKey || !apiSecret || !cloudName) return false;

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash('sha1').update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`).digest('hex');
  const form = new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), api_key: apiKey, signature });

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, { method: 'POST', body: form });
    return res.ok;
  } catch (error) {
    console.error('[cloudinary] No se pudo borrar el archivo:', publicId, error);
    return false;
  }
}

/**
 * Borra todos los archivos bajo una carpeta (solo lo usa el reinicio del sandbox).
 * Admin API de Cloudinary: hasta 1000 por llamada, suficiente para el sandbox.
 */
export async function deleteCloudinaryPrefix(prefix: string): Promise<boolean> {
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!prefix || !apiKey || !apiSecret || !cloudName) return false;
  const authHeader = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
  let ok = true;
  for (const type of ['image', 'video'] as const) {
    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/resources/${type}/upload?prefix=${encodeURIComponent(prefix)}`,
        { method: 'DELETE', headers: { Authorization: authHeader } }
      );
      ok = ok && res.ok;
    } catch (error) {
      console.error('[cloudinary] No se pudo vaciar la carpeta:', prefix, error);
      ok = false;
    }
  }
  return ok;
}
