import { NextResponse, after } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { sendPqrsReplyEmail } from '@/services/mail';
import { verifyAdminRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';

// El correo se envía en segundo plano (after); damos margen para reintentos.
export const maxDuration = 30

export async function POST(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const { pqrsId, responseMessage, userEmail, userName, originalMessage } = await request.json();

    if (!pqrsId || !responseMessage || !userEmail) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const db = getAdminFirestore();

    // 1. Marcar el PQRS como resuelto en Firestore (fuente de verdad).
    await db.collection('pqrs').doc(pqrsId).update({
      estado: 'resuelto',
      respuesta_admin: responseMessage,
      fecha_respuesta: new Date()
    });

    // 2. Auditoría.
    await recordAuditLog({
      action: 'RESPOND_PQRS',
      category: 'ADMIN_ACTION',
      details: `Respuesta oficial enviada vía Email al socio ${userEmail} para el ticket ${pqrsId}`,
      adminEmail: isAdmin.email,
      targetId: pqrsId,
      request: request,
    });

    // 3. Enviar el correo al usuario SIN bloquear la respuesta: si el envío
    //    falla tras los reintentos, el ticket ya quedó resuelto y solo se registra.
    after(() =>
      sendPqrsReplyEmail({
        to: userEmail,
        customerName: userName || 'Usuario',
        originalMessage,
        adminResponse: responseMessage
      }).catch((err: any) => {
        console.error(
          `[pqrs] No se pudo enviar el correo de respuesta (${pqrsId}) tras los reintentos:`,
          err?.message || err
        )
      })
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al responder PQRS:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
