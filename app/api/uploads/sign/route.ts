import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { isMfaSatisfied, mfaRequiredResponse } from '@/lib/mfa-server';
import { limitAction, tooManyRequests } from '@/lib/rate-limit-server';
import { IS_SANDBOX, SANDBOX_UPLOAD_ROOT } from '@/lib/sandbox';

/**
 * POST /api/uploads/sign — firma una subida a Cloudinary (F1-24).
 *
 * Con el preset sin firma, cualquiera que viera el código podía subir archivos a
 * la cuenta del negocio. Ahora solo un usuario autenticado obtiene una firma de
 * corta vida, limitada a una carpeta y a formatos permitidos.
 *
 * Requiere `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET`. Si faltan responde 501 y
 * el cliente usa el preset sin firma (compatibilidad) hasta que se configuren.
 * Al configurarlas, DESACTIVAR el preset sin firma en Cloudinary.
 */
const IMAGE_FORMATS = 'jpg,jpeg,png,webp';
const VIDEO_FORMATS = 'mp4,webm,mov';

export async function POST(request: Request) {
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!apiKey || !apiSecret || !cloudName) {
    return NextResponse.json({ error: 'Subidas firmadas no configuradas.' }, { status: 501 });
  }

  const authHeader = request.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  let uid: string;
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    if (!(await isMfaSatisfied(decodedToken))) return mfaRequiredResponse();
    uid = decodedToken.uid;
  } catch {
    return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
  }

  // F1-10: 30 subidas por hora por usuario.
  const rl = await limitAction(`upload:${uid}`, 30, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, 'Alcanzaste el límite de subidas por hora.');

  const body = await request.json().catch(() => null);
  const resourceType = body?.resourceType === 'video' ? 'video' : 'image';
  const purpose = body?.purpose === 'avatar' ? 'avatars' : 'forum';

  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string | number> = {
    allowed_formats: resourceType === 'video' ? VIDEO_FORMATS : IMAGE_FORMATS,
    // El sandbox sube a su propia carpeta: el reinicio la vacía completa.
    folder: `${IS_SANDBOX ? SANDBOX_UPLOAD_ROOT : 'fitmania'}/${purpose}/${uid}`,
    timestamp,
  };

  // Firma de Cloudinary: parámetros ordenados alfabéticamente + secreto, SHA-1.
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const signature = createHash('sha1').update(toSign + apiSecret).digest('hex');

  return NextResponse.json({ cloudName, apiKey, signature, resourceType, ...params });
}
