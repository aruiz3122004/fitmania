import type { Firestore } from 'firebase-admin/firestore';
import { publicProfileOf } from '@/lib/public-profile';

/**
 * Migraciones de datos versionadas (F2-14).
 *
 * Cada migración es idempotente (volver a ejecutarla no cambia nada) y admite
 * `dryRun` para ver qué haría sin escribir. El resultado de cada ejecución real
 * queda en `_migrations/{id}`. Se ejecutan desde el panel admin
 * (POST /api/admin/migrations) o con un script que use el Admin SDK.
 */
export interface MigrationResult {
  examined: number;
  changed: number;
  details: string[];
}

export interface Migration {
  id: string;
  description: string;
  run: (db: Firestore, opts: { dryRun: boolean }) => Promise<MigrationResult>;
}

const MAX_DETAILS = 50;

/** 001 — Comentarios del array `comentarios` de cada post → subcolección `comments` (F1-07). */
const forumCommentsToSubcollection: Migration = {
  id: '001_forum_comments_subcollection',
  description: 'Mueve los comentarios embebidos en posts.comentarios a posts/{id}/comments.',
  async run(db, { dryRun }) {
    const posts = await db.collection('posts').get();
    const result: MigrationResult = { examined: posts.size, changed: 0, details: [] };
    const writer = dryRun ? null : db.bulkWriter();

    for (const post of posts.docs) {
      const comentarios = post.data().comentarios;
      if (!Array.isArray(comentarios) || comentarios.length === 0) continue;
      result.changed++;
      if (result.details.length < MAX_DETAILS) result.details.push(`${post.id}: ${comentarios.length} comentarios`);
      if (!writer) continue;

      for (const c of comentarios) {
        // ID estable derivado del original → repetir la migración no duplica.
        const safeId = String(c.id || `${c.autor_id}-${c.created_at?.seconds ?? ''}`).replace(/\//g, '_').slice(0, 150) || undefined;
        const ref = safeId ? post.ref.collection('comments').doc(safeId) : post.ref.collection('comments').doc();
        writer.set(ref, {
          autor_id: c.autor_id || '',
          autor_username: c.autor_username || 'Usuario',
          autor_avatar: c.autor_avatar || '',
          autor_is_premium: !!c.autor_is_premium,
          contenido: String(c.contenido || '').slice(0, 1000),
          created_at: c.created_at || new Date(),
        });
      }
      writer.update(post.ref, { comentarios: [] });
    }

    if (writer) await writer.close();
    return result;
  },
};

/** 002 — Planes sin `days`: se asigna la duración que antes se deducía del nombre (B3). */
const planDaysDefault: Migration = {
  id: '002_plan_days_default',
  description: 'Asigna `days` a los planes que no lo tienen (30; 40 si dice "parejas"; 60 si dice "dos en uno").',
  async run(db, { dryRun }) {
    const planes = await db.collection('planes').get();
    const result: MigrationResult = { examined: planes.size, changed: 0, details: [] };
    for (const plan of planes.docs) {
      const data = plan.data();
      if (Number(data.days) > 0) continue;
      const name = String(data.name || '').toLowerCase();
      const days = name.includes('parejas') ? 40 : name.includes('dos en uno') ? 60 : 30;
      result.changed++;
      result.details.push(`${plan.id} (${data.name || 'sin nombre'}): days = ${days}`);
      if (!dryRun) await plan.ref.update({ days, updatedAt: new Date() });
    }
    return result;
  },
};

/** 003 — Productos con precio solo en `price` (inglés) → `precio`, el campo que usa la app. */
const productPriceField: Migration = {
  id: '003_product_precio_field',
  description: 'Copia `price` a `precio` en productos antiguos que no tienen `precio`.',
  async run(db, { dryRun }) {
    const products = await db.collection('products').get();
    const result: MigrationResult = { examined: products.size, changed: 0, details: [] };
    for (const product of products.docs) {
      const data = product.data();
      if (data.precio !== undefined || data.price === undefined) continue;
      result.changed++;
      result.details.push(`${product.id}: precio = ${data.price}`);
      if (!dryRun) await product.ref.update({ precio: Number(data.price) || 0 });
    }
    return result;
  },
};

/** 004 — Perfil público (nombre y foto) de cada socio para el foro (F1-09). */
const publicProfiles: Migration = {
  id: '004_public_profiles',
  description: 'Crea o actualiza public_profiles/{uid} (nombre y foto) desde users para resolver el avatar por autor en el foro.',
  async run(db, { dryRun }) {
    const users = await db.collection('users').select('username', 'photoURL').get();
    const existing = await db.collection('public_profiles').get();
    const current = new Map(existing.docs.map((d) => [d.id, d.data()]));
    const result: MigrationResult = { examined: users.size, changed: 0, details: [] };
    const writer = dryRun ? null : db.bulkWriter();
    for (const user of users.docs) {
      const profile = publicProfileOf(user.data());
      const prev = current.get(user.id);
      if (prev && prev.username === profile.username && (prev.photoURL ?? null) === profile.photoURL) continue;
      result.changed++;
      if (result.details.length < MAX_DETAILS) result.details.push(`${user.id}: ${profile.username}`);
      writer?.set(db.collection('public_profiles').doc(user.id), { ...profile, updatedAt: new Date() });
    }
    if (writer) await writer.close();
    return result;
  },
};

export const MIGRATIONS: Migration[] = [forumCommentsToSubcollection, planDaysDefault, productPriceField, publicProfiles];

export function findMigration(id: string): Migration | undefined {
  return MIGRATIONS.find((m) => m.id === id);
}
