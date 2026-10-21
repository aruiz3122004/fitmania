import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyReceptionRequest } from '@/lib/auth-helpers';
import { getMemberDetail } from '@/lib/reception-members';

/**
 * GET /api/recepcion/members/:uid — ficha del socio escaneado (F2-18).
 *
 * Una lectura del socio + sus últimas órdenes y check-ins, con datos mínimos.
 * Reemplaza las lecturas directas del navegador a `users`, `orders` y `checkIns`.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const decoded = await verifyReceptionRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const { uid } = await params;
  if (!uid || uid.includes('/') || uid.length > 128) {
    return NextResponse.json({ error: 'Código inválido.' }, { status: 400 });
  }

  try {
    const detail = await getMemberDetail(getAdminFirestore(), uid);
    if (!detail) return NextResponse.json({ error: 'Socio no encontrado.' }, { status: 404 });
    return NextResponse.json(detail);
  } catch (error) {
    console.error('[/api/recepcion/members/:uid]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
