import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { generatePlanExpiryNotifications } from '@/lib/notifications';
import { applyRetention } from '@/lib/retention';
import { timingSafeEqualStrings } from '@/lib/gate-token';
import { reconcilePendingPayments } from '@/lib/payments/reconcile';
import { closeDailyStats } from '@/lib/attendance';
import { getDateKeyInAppTz } from '@/lib/datetime';

// T-18: job programado (Vercel Cron) que genera las notificaciones de planes por
// vencer. Se mantiene fuera del panel admin para que el GET sea solo lectura.
//
// Autenticación: Vercel Cron envía `Authorization: Bearer <CRON_SECRET>` cuando la
// variable de entorno `CRON_SECRET` está definida en el proyecto. Si no lo está,
// la ruta responde 401 (nunca queda abierta).
export const dynamic = 'force-dynamic';
// Envía recordatorios por correo (F3-22): margen para varios envíos secuenciales.
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  // Comparación en tiempo constante (no filtra el secreto por tiempos de respuesta).
  if (!cronSecret || !timingSafeEqualStrings(authHeader || '', `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const db = getAdminFirestore();
    const result = await generatePlanExpiryNotifications(db);
    // F2-26: política de retención (por lotes; si falla no afecta los avisos).
    const retention = await applyRetention(db).catch((err) => {
      console.error('[cron] Error aplicando la retención de datos:', err);
      return null;
    });
    // F1-22: pagos de Mercado Pago que siguen pendientes (webhook perdido).
    const payments = await reconcilePendingPayments(db).catch((err) => {
      console.error('[cron] Error conciliando pagos pendientes:', err);
      return null;
    });
    // F3-01: cierre de los días anteriores y resumen mensual (Vercel Hobby: un cron diario).
    const attendance = await closeDailyStats(db, getDateKeyInAppTz()).catch((err) => {
      console.error('[cron] Error cerrando la asistencia diaria:', err);
      return null;
    });
    // F2-13: registro de la última ejecución (el panel alerta si el cron deja de correr).
    await db.collection('system').doc('cron').set(
      {
        notifications: { lastRun: new Date(), ...result },
        retention: retention ? { lastRun: new Date(), ...retention } : null,
        payments: payments ? { lastRun: new Date(), ...payments } : null,
        attendance: attendance ? { lastRun: new Date(), ...attendance } : null,
      },
      { merge: true }
    );
    return NextResponse.json({ success: true, ...result, retention, payments, attendance });
  } catch (error: any) {
    console.error('Error generando notificaciones programadas:', error);
    // F1-03: el detalle queda en logs; el cliente recibe un mensaje genérico.
    console.error('[/api/cron/notifications]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
