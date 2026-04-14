import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { sendPqrsReplyEmail } from '@/services/mail';
import { verifyAdminRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';

export async function POST(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const { pqrsId, responseMessage, userEmail, userName, originalMessage } = await request.json();

    if (!pqrsId || !responseMessage || !userEmail) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const db = getAdminFirestore();

    // 1. Enviar correo al usuario
    await sendPqrsReplyEmail({
      to: userEmail,
      customerName: userName || 'Usuario',
      originalMessage,
      adminResponse: responseMessage
    });

    await db.collection('pqrs').doc(pqrsId).update({
      estado: 'resuelto',
      respuesta_admin: responseMessage,
      fecha_respuesta: new Date()
    });

    await recordAuditLog({
      action: 'RESPOND_PQRS',
      category: 'ADMIN_ACTION',
      details: `Respesta oficial enviada vía Email al socio ${userEmail} para el ticket ${pqrsId}`,
      adminEmail: isAdmin.email,
      targetId: pqrsId,
      request: request,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al responder PQRS:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
