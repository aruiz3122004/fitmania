import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';
import { listAllAuthUsers } from '@/lib/admin-users';
import { deleteMemberAccount } from '@/lib/account-deletion';

export async function GET(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const db = getAdminFirestore();

    // Obtener usuarios de Auth (todas las páginas; antes se cortaba en 1000 — F2-20)
    const authUsers = await listAllAuthUsers();
    
    // Obtener todos los documentos de la colección users en Firestore
    const snapshot = await db.collection('users').get();
    const firestoreUsers: Record<string, any> = {};
    snapshot.forEach(doc => {
      firestoreUsers[doc.id] = doc.data();
    });

    const users = authUsers.map(user => {
      const fsData = firestoreUsers[user.uid] || {};
      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || fsData.username || 'Usuario sin nombre',
        photoURL: user.photoURL || fsData.photoURL || null,
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime,
        admin: user.customClaims?.admin || false,
        receptionist: user.customClaims?.receptionist || false,
        plan: fsData.plan || null,
        // Incluir otros datos relevantes de firestore si existen
        ...fsData
      };
    });

    return NextResponse.json(users);
  } catch (error: any) {
    // F1-03: el detalle queda en logs; el cliente recibe un mensaje genérico.
    console.error('[/api/admin/users]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const { uid, plan, admin: setAdmin, receptionist: setReceptionist } = await request.json();
    if (typeof uid !== 'string' || !uid || uid.includes('/')) return NextResponse.json({ error: 'UID requerido' }, { status: 400 });
    if ((setAdmin !== undefined && typeof setAdmin !== 'boolean') || (setReceptionist !== undefined && typeof setReceptionist !== 'boolean')) {
      return NextResponse.json({ error: 'Los roles deben ser verdadero o falso.' }, { status: 400 });
    }
    // Evita que el admin se quite su propio rol por error y quede sin acceso al panel.
    if (setAdmin === false && uid === isAdmin.uid) {
      return NextResponse.json({ error: 'No puedes retirarte tu propio rol de administrador.' }, { status: 400 });
    }

    const auth = getAdminAuth();
    const db = getAdminFirestore();

    // T-16: gestión centralizada y revocable de claims. Se FUSIONAN con los claims
    // actuales para no borrar el otro rol (evita el "clobbering" de claims).
    let claimsChanged = false;
    if (setAdmin !== undefined || setReceptionist !== undefined) {
      const currentClaims = (await auth.getUser(uid)).customClaims || {};
      const claims: Record<string, any> = { ...currentClaims };
      if (setAdmin !== undefined) claims.admin = !!setAdmin;
      if (setReceptionist !== undefined) claims.receptionist = !!setReceptionist;
      await auth.setCustomUserClaims(uid, claims);
      claimsChanged = true;
      // Al retirar privilegios, revocar refresh tokens → invalida sesiones vigentes
      // (verifySessionCookie con checkRevoked las rechaza de inmediato).
      if (setAdmin === false || setReceptionist === false) {
        await auth.revokeRefreshTokens(uid);
      }
    }

    // Actualizar el plan con lista blanca de campos (F1-04): antes se guardaba
    // el objeto recibido tal cual (`{ ...plan }`).
    const updates: any = {};
    if (plan !== undefined) {
      if (plan && typeof plan === 'object') {
        const inicio = new Date(plan.inicio);
        const expira = new Date(plan.expira);
        if (Number.isNaN(inicio.getTime()) || Number.isNaN(expira.getTime()) || expira <= inicio) {
          return NextResponse.json({ error: 'Fechas del plan inválidas (la expiración debe ser posterior al inicio).' }, { status: 400 });
        }
        const existingPlan = (await db.collection('users').doc(uid).get()).data()?.plan || {};
        const nombre = typeof plan.nombre === 'string' && plan.nombre.trim()
          ? plan.nombre.trim().slice(0, 100)
          : existingPlan.nombre || 'Plan asignado por administración';
        const precio = Number(plan.precio ?? existingPlan.precio ?? 0);
        updates.plan = {
          nombre,
          precio: Number.isFinite(precio) && precio >= 0 ? precio : 0,
          dias_total: Math.max(1, Math.round((expira.getTime() - inicio.getTime()) / 86400000)),
          inicio,
          expira,
          planId: typeof plan.planId === 'string' ? plan.planId : existingPlan.planId || null,
          // El acompañante se conserva desde la BD (no se acepta del body).
          acompanante: existingPlan.acompanante || null,
        };
      } else if (plan === null) {
        updates.plan = null; // Remover plan
      } else {
        return NextResponse.json({ error: 'Plan inválido.' }, { status: 400 });
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.collection('users').doc(uid).update(updates);
    }

    if (Object.keys(updates).length > 0 || claimsChanged) {
      // Audit Log
      await recordAuditLog({
        action: 'UPDATE_USER',
        category: 'ADMIN_ACTION',
        details: `Socio [${uid}] actualizado: ${plan !== undefined ? (plan ? 'Modificó plan' : 'Removió plan') : ''} ${setAdmin !== undefined ? (setAdmin ? 'Elevado a ADMIN' : 'Bajado a SOCIO') : ''} ${setReceptionist !== undefined ? (setReceptionist ? 'Otorgó RECEPCIÓN' : 'Retiró RECEPCIÓN') : ''}`.trim(),
        adminEmail: isAdmin.email,
        targetId: uid,
        request,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // F1-03: el detalle queda en logs; el cliente recibe un mensaje genérico.
    console.error('[/api/admin/users]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    if (!uid) return NextResponse.json({ error: 'UID requerido' }, { status: 400 });

    const auth = getAdminAuth();
    const db = getAdminFirestore();

    if (uid === isAdmin.uid) {
      return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta de administrador.' }, { status: 400 });
    }
    // F2-26: supresión completa (posts, comentarios y likes borrados; ingresos, PQRS y
    // reportes anonimizados; órdenes conservadas por obligación contable).
    const summary = await deleteMemberAccount(db, auth, uid);

    // Audit Log
    await recordAuditLog({
      action: 'DELETE_USER',
      category: 'ADMIN_ACTION',
      details: `Socio eliminado (supresión). UID: ${uid}. Posts: ${summary.posts}, comentarios: ${summary.comments}, ingresos anonimizados: ${summary.entries}.`,
      adminEmail: isAdmin.email,
      targetId: uid,
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // F1-03: el detalle queda en logs; el cliente recibe un mensaje genérico.
    console.error('[/api/admin/users]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
