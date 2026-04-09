import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { sendPqrsReplyEmail } from '@/services/mail';

async function validateAdmin(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const idToken = authHeader.split('Bearer ')[1];
  const auth = getAdminAuth();
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken.admin ? decodedToken : null;
  } catch (err) {
    return null;
  }
}

export async function POST(request: Request) {
  const isAdmin = await validateAdmin(request);
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

    // 2. Marcar como resuelto en Firestore
    await db.collection('pqrs').doc(pqrsId).update({
      estado: 'resuelto',
      respuesta_admin: responseMessage,
      fecha_respuesta: new Date()
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error al responder PQRS:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
