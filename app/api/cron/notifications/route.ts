import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { generatePlanExpiryNotifications } from '@/lib/notifications';

// T-18: job programado (Vercel Cron) que genera las notificaciones de planes por
// vencer. Se mantiene fuera del panel admin para que el GET sea solo lectura.
//
// Autenticación: Vercel Cron envía `Authorization: Bearer <CRON_SECRET>` cuando la
// variable de entorno `CRON_SECRET` está definida en el proyecto. Si no lo está,
// la ruta responde 401 (nunca queda abierta).
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const db = getAdminFirestore();
    const result = await generatePlanExpiryNotifications(db);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error generando notificaciones programadas:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
