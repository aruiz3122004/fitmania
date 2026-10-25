import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyReceptionRequest } from '@/lib/auth-helpers';
import { getMemberDetail } from '@/lib/reception-members';
import { ACCESS_TOKEN_PREFIX, requireSignedAccess, verifyAccessToken } from '@/lib/access-token';
import { limitAction, tooManyRequests } from '@/lib/rate-limit-server';

/**
 * POST /api/recepcion/scan { code } — resuelve el QR escaneado (F2-05).
 * - `FM1.…`: pase firmado → se verifica firma y vigencia (5 min o 24 h).
 * - UID plano (QR antiguo): se acepta mientras QR_REQUIRE_SIGNED no esté activo.
 */
const REASONS: Record<string, string> = {
  expired: 'El pase de acceso expiró. Pide al socio que abra la app con conexión para renovarlo.',
  signature: 'Pase de acceso inválido (firma incorrecta).',
  format: 'Código QR no reconocido.',
  disabled: 'El servidor no tiene configuradas las claves del pase de acceso.',
};

export async function POST(request: NextRequest) {
  const decoded = await verifyReceptionRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const rl = await limitAction(`scan:${decoded.uid}`, 1200, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const body = await request.json().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  if (!code || code.length > 2000) return NextResponse.json({ error: 'Código vacío.' }, { status: 400 });

  let uid: string;
  let signed = false;
  if (code.startsWith(ACCESS_TOKEN_PREFIX)) {
    const result = verifyAccessToken(code);
    if (!result.ok) return NextResponse.json({ error: REASONS[result.reason] }, { status: 422 });
    uid = result.payload.uid;
    signed = true;
  } else {
    // La selección manual desde el directorio la hace la recepcionista autenticada.
    if (requireSignedAccess() && body?.manual !== true) {
      return NextResponse.json({ error: 'QR antiguo no válido: el socio debe actualizar la app y mostrar su nuevo pase.' }, { status: 422 });
    }
    if (code.includes('/') || code.length > 128) return NextResponse.json({ error: REASONS.format }, { status: 400 });
    uid = code;
  }

  try {
    const detail = await getMemberDetail(getAdminFirestore(), uid);
    if (!detail) return NextResponse.json({ error: 'Socio no encontrado.' }, { status: 404 });
    return NextResponse.json({ ...detail, signed });
  } catch (error) {
    console.error('[/api/recepcion/scan]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
