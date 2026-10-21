import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyUserRequest } from '@/lib/auth-helpers';
import { createAccessToken, signedAccessEnabled } from '@/lib/access-token';
import { limitAction, tooManyRequests } from '@/lib/rate-limit-server';

/**
 * GET /api/me/access-token?ttl=short|day — pase de acceso firmado del socio (F2-05).
 * - short (5 min): el que se muestra mientras hay red (se renueva solo).
 * - day (24 h): respaldo guardado en el dispositivo para mostrarlo sin conexión.
 */
const TTL = { short: 5 * 60, day: 24 * 60 * 60 } as const;

export async function GET(request: Request) {
  const decoded = await verifyUserRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const rl = await limitAction(`pass:${decoded.uid}`, 60, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);
  if (!signedAccessEnabled()) return NextResponse.json({ enabled: false });

  try {
    const ttlParam = new URL(request.url).searchParams.get('ttl') === 'day' ? 'day' : 'short';
    const snap = await getAdminFirestore().collection('users').doc(decoded.uid).get();
    const user = snap.data() || {};
    const expira = user.plan?.expira?.toDate ? user.plan.expira.toDate() : user.plan?.expira ? new Date(user.plan.expira) : null;

    const token = createAccessToken(
      {
        uid: decoded.uid,
        n: String(user.username || decoded.email?.split('@')[0] || 'Socio').slice(0, 40),
        p: user.plan?.nombre ? String(user.plan.nombre).slice(0, 60) : null,
        pe: expira && !Number.isNaN(expira.getTime()) ? expira.getTime() : null,
      },
      TTL[ttlParam]
    );

    return NextResponse.json(
      { enabled: true, token, expiresAt: Date.now() + TTL[ttlParam] * 1000 },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[/api/me/access-token]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
