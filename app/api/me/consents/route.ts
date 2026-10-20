import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyUserRequest } from '@/lib/auth-helpers';
import { getConsent, recordConsent } from '@/lib/consents';

/**
 * Autorización de datos sensibles (peso/altura) — F3-10 / F3-11.
 * GET  → { sensitiveConsent }
 * POST { sensitiveConsent: boolean } → otorga o revoca; al revocar se borran peso y altura.
 */
export async function GET(request: Request) {
  const decoded = await verifyUserRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  try {
    const sensitiveConsent = await getConsent(getAdminFirestore(), decoded.uid, 'sensitive_data');
    return NextResponse.json({ sensitiveConsent });
  } catch (error) {
    console.error('[/api/me/consents GET]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const decoded = await verifyUserRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (typeof body?.sensitiveConsent !== 'boolean') {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    await recordConsent(db, decoded.uid, 'sensitive_data', body.sensitiveConsent, request);
    if (!body.sensitiveConsent) {
      // Revocar implica suprimir los datos sensibles ya guardados.
      await db.collection('users').doc(decoded.uid).set(
        { peso: FieldValue.delete(), altura: FieldValue.delete() },
        { merge: true }
      );
    }
    return NextResponse.json({ success: true, sensitiveConsent: body.sensitiveConsent });
  } catch (error) {
    console.error('[/api/me/consents POST]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
