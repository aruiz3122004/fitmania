import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';

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

export async function GET(request: Request) {
  const isAdmin = await validateAdmin(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const db = getAdminFirestore();

    // --- Lógica de Auto-Generación de Notificaciones (Planes por vencer) ---
    const now = new Date();
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(now.getDate() + 5);
    const oneDayFromNow = new Date();
    oneDayFromNow.setDate(now.getDate() + 1);

    const usersSnapshot = await db.collection('users').where('plan', '!=', null).get();
    const batch = db.batch();
    let hasNewNotifications = false;

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const plan = userData.plan;
      if (!plan || !plan.expira) continue;

      const expirationDate = plan.expira.toDate ? plan.expira.toDate() : new Date(plan.expira);
      const diffTime = expirationDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // ID único para evitar duplicados: tipo_uid_fecha (día)
      const dateKey = now.toISOString().split('T')[0];

      if (diffDays <= 5 && diffDays > 1) {
        const notifId = `plan5_${doc.id}_${dateKey}`;
        const notifRef = db.collection('notifications').doc(notifId);
        const existing = await notifRef.get();
        if (!existing.exists) {
          batch.set(notifRef, {
            tipo: 'plan_expiry',
            mensaje: `El plan de ${userData.displayName || userData.username} vence en 5 días.`,
            uid: doc.id,
            leido: false,
            fecha: new Date()
          });
          hasNewNotifications = true;
        }
      } else if (diffDays <= 1 && diffDays >= 0) {
        const notifId = `plan1_${doc.id}_${dateKey}`;
        const notifRef = db.collection('notifications').doc(notifId);
        const existing = await notifRef.get();
        if (!existing.exists) {
          batch.set(notifRef, {
            tipo: 'plan_expiry',
            mensaje: `¡URGENTE! El plan de ${userData.displayName || userData.username} vence mañana.`,
            uid: doc.id,
            leido: false,
            fecha: new Date()
          });
          hasNewNotifications = true;
        }
      }
    }

    if (hasNewNotifications) await batch.commit();

    // --- Retornar las notificaciones ---
    const snapshot = await db.collection('notifications').orderBy('fecha', 'desc').limit(50).get();
    const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json(notifications);
  } catch (error: any) {
    console.error('Error in notifications GET:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Marcar como leída
export async function PATCH(request: Request) {
  const isAdmin = await validateAdmin(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    const db = getAdminFirestore();
    await db.collection('notifications').doc(id).update({ leido: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Limpiar leídas
export async function DELETE(request: Request) {
  const isAdmin = await validateAdmin(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const db = getAdminFirestore();
    const snapshot = await db.collection('notifications').where('leido', '==', true).get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
