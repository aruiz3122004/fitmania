import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyUserRequest } from '@/lib/auth-helpers';
import { limitAction, tooManyRequests } from '@/lib/rate-limit-server';
import { formatInAppTz } from '@/lib/datetime';

/**
 * POST /api/pqrs { tipo, mensaje } — radica una PQRS (Ley 1480 / Ley 1581).
 * Antes el navegador escribía directo en Firestore sin límite (spam). Ahora el
 * servidor toma nombre y correo del perfil/token y limita 5 por hora por usuario.
 */
const TIPOS = new Set(['peticion', 'queja', 'reclamo', 'sugerencia', 'datos_personales']);

export async function POST(request: Request) {
  const decoded = await verifyUserRequest(request);
  if (!decoded) return NextResponse.json({ error: 'Debes iniciar sesión.' }, { status: 401 });

  const rl = await limitAction(`pqrs:${decoded.uid}`, 5, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter, 'Ya enviaste varias solicitudes. Intenta de nuevo más tarde.');

  const body = await request.json().catch(() => null);
  const tipo = typeof body?.tipo === 'string' ? body.tipo : '';
  const mensaje = typeof body?.mensaje === 'string' ? body.mensaje.trim() : '';
  if (!TIPOS.has(tipo)) return NextResponse.json({ error: 'Tipo de solicitud inválido.' }, { status: 400 });
  if (mensaje.length < 20 || mensaje.length > 3000) {
    return NextResponse.json({ error: 'El mensaje debe tener entre 20 y 3000 caracteres.' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const profile = (await db.collection('users').doc(decoded.uid).get()).data() || {};
    const now = new Date();
    const ref = await db.collection('pqrs').add({
      tipo,
      mensaje,
      userId: decoded.uid,
      userName: String(profile.username || decoded.email?.split('@')[0] || 'Usuario'),
      userEmail: decoded.email || '',
      fecha: formatInAppTz(now, { day: '2-digit', month: '2-digit', year: 'numeric' }),
      hora: formatInAppTz(now, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      createdAt: now,
      status: 'pending',
    });
    await db.collection('notifications').add({
      tipo: 'pqrs',
      mensaje: `Nueva PQRS (${tipo.replace('_', ' ')}) de ${profile.username || 'un socio'}.`,
      id_pqrs: ref.id,
      leido: false,
      fecha: now,
    });
    return NextResponse.json({ success: true, id: ref.id });
  } catch (error) {
    console.error('[/api/pqrs]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
