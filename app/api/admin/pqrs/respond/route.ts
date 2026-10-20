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
    const body = await request.json();
    const pqrsId = typeof body?.pqrsId === 'string' ? body.pqrsId : '';
    const responseMessage = typeof body?.responseMessage === 'string' ? body.responseMessage.trim() : '';

    if (!pqrsId || pqrsId.includes('/') || !responseMessage) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }
    if (responseMessage.length > 5000) {
      return NextResponse.json({ error: 'La respuesta supera 5000 caracteres.' }, { status: 400 });
    }

    const db = getAdminFirestore();

    // F1-04: destinatario, nombre y mensaje original salen del ticket guardado,
    // no del body (antes se podía enviar el correo a cualquier dirección).
    const pqrsSnap = await db.collection('pqrs').doc(pqrsId).get();
    if (!pqrsSnap.exists) {
      return NextResponse.json({ error: 'PQRS no encontrada' }, { status: 404 });
    }
    const ticket = pqrsSnap.data() || {};
    const userEmail = String(ticket.userEmail || '');
    const userName = String(ticket.userName || 'Usuario');
    const originalMessage = String(ticket.mensaje || '');
    if (!userEmail) {
      return NextResponse.json({ error: 'La PQRS no tiene correo de contacto.' }, { status: 400 });
    }

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
    // F1-03: el detalle queda en logs; el cliente recibe un mensaje genérico.
    console.error('[/api/admin/pqrs/respond]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
