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
