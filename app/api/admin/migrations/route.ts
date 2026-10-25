import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';
import { MIGRATIONS, findMigration } from '@/lib/migrations';

/**
 * Migraciones de datos (F2-14).
 * GET  → lista de migraciones con su última ejecución.
 * POST { id, dryRun } → ejecuta (o simula) una migración. Siempre idempotente.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const db = getAdminFirestore();
    const snaps = await db.getAll(...MIGRATIONS.map((m) => db.collection('_migrations').doc(m.id)));
    const list = MIGRATIONS.map((m, i) => {
      const run = snaps[i].data();
      return {
        id: m.id,
        description: m.description,
        lastRunAt: run?.lastRunAt?.toDate ? run.lastRunAt.toDate().toISOString() : null,
        lastResult: run?.lastResult || null,
      };
    });
    return NextResponse.json(list);
  } catch (error) {
    console.error('[/api/admin/migrations GET]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const body = await request.json().catch(() => null);
    const migration = typeof body?.id === 'string' ? findMigration(body.id) : undefined;
    if (!migration) return NextResponse.json({ error: 'Migración desconocida.' }, { status: 400 });
    const dryRun = body?.dryRun !== false; // por defecto simula

    const db = getAdminFirestore();
    const result = await migration.run(db, { dryRun });

    if (!dryRun) {
      await db.collection('_migrations').doc(migration.id).set({
        lastRunAt: new Date(),
        lastRunBy: isAdmin.email || null,
        lastResult: { examined: result.examined, changed: result.changed },
      }, { merge: true });
      await recordAuditLog({
        action: 'RUN_MIGRATION',
        category: 'ADMIN_ACTION',
        details: `Migración ${migration.id}: ${result.changed} de ${result.examined} documentos modificados.`,
        adminEmail: isAdmin.email,
        actorUid: isAdmin.uid,
        targetId: migration.id,
        request,
      });
    }

    return NextResponse.json({ id: migration.id, dryRun, ...result });
  } catch (error) {
    console.error('[/api/admin/migrations POST]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
