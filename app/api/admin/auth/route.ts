import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { uid, secretToken } = await request.json();

    if (!uid || !secretToken) {
      return NextResponse.json({ error: 'Faltan parámetros.' }, { status: 400 });
    }

    const expectedToken = process.env.ADMIN_SECRET_TOKEN || 'FitmaniaAdmin2026';

    if (secretToken !== expectedToken) {
      return NextResponse.json({ error: 'Token secreto inválido.' }, { status: 403 });
    }

    // Inicializamos el servicio de Auth de forma segura
    const auth = getAdminAuth();

    // Asignamos el Custom Claim de admin al usuario
    await auth.setCustomUserClaims(uid, { admin: true });

    return NextResponse.json({ message: 'Privilegios de administrador concedidos correctamente.' }, { status: 200 });

  } catch (error: any) {
    console.error('Error en API Admin Auth:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
