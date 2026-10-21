import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyAdminRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';
import { ValidationError, parseProductCreate } from '@/lib/admin-validation';

/**
 * Importación masiva de productos desde CSV (F2-28).
 * POST { rows: Record<string,string>[], dryRun: boolean }
 * - Valida cada fila con las mismas reglas del formulario (lista blanca de campos).
 * - dryRun (por defecto): devuelve el resultado por fila sin escribir.
 * - Sin errores y dryRun=false: crea o actualiza (por slug del nombre) con BulkWriter;
 *   los cambios de stock quedan como movimientos de inventario.
 */
const MAX_ROWS = 500;

function slugify(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}

const list = (v: unknown) => (typeof v === 'string' && v.trim() ? v.split('|').map((x) => x.trim()).filter(Boolean) : undefined);

export async function POST(request: Request) {
  const isAdmin = await verifyAdminRequest(request);
  if (!isAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const rows: unknown = body?.rows;
  const dryRun = body?.dryRun !== false;
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: 'El archivo no tiene filas.' }, { status: 400 });
  if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Máximo ${MAX_ROWS} filas por importación.` }, { status: 400 });

  const results: { row: number; id?: string; nombre?: string; error?: string }[] = [];
  const parsed: { id: string; data: Record<string, unknown> }[] = [];
  const seen = new Set<string>();

  rows.forEach((raw: any, i) => {
    const rowNumber = i + 2; // fila 1 = encabezados
    try {
      const data = parseProductCreate({
        nombre: raw?.nombre,
        precio: raw?.precio,
        categoria: raw?.categoria || undefined,
        stock: raw?.stock === '' || raw?.stock === undefined ? undefined : raw.stock,
        lowStockThreshold: raw?.lowStockThreshold === '' || raw?.lowStockThreshold === undefined ? undefined : raw.lowStockThreshold,
        descripcion: raw?.descripcion || undefined,
        imagen_url: raw?.imagen_url || undefined,
        badge: raw?.badge || undefined,
        colores: list(raw?.colores),
        tallas: list(raw?.tallas),
      });
      const id = slugify(String(data.nombre));
      if (!id) throw new ValidationError('Nombre inválido para generar el ID.');
      if (seen.has(id)) throw new ValidationError(`Producto repetido en el archivo (${id}).`);
      seen.add(id);
      parsed.push({ id, data });
      results.push({ row: rowNumber, id, nombre: String(data.nombre) });
    } catch (err: any) {
      results.push({ row: rowNumber, error: err instanceof ValidationError ? err.message : 'Fila inválida.' });
    }
  });

  const errors = results.filter((r) => r.error).length;
  if (dryRun || errors > 0) {
    return NextResponse.json({ dryRun: true, total: rows.length, valid: parsed.length, errors, results });
  }

  try {
    const db = getAdminFirestore();
    const refs = parsed.map((p) => db.collection('products').doc(p.id));
    const existing = await db.getAll(...refs);
    const writer = db.bulkWriter();
    let created = 0;
    let updated = 0;
    const now = new Date();

    parsed.forEach((p, i) => {
      const before = existing[i];
      if (before.exists) {
        writer.set(refs[i], p.data, { merge: true });
        updated++;
      } else {
        writer.set(refs[i], { ...p.data, created_at: now });
        created++;
      }
      const prevStock = before.exists ? Number(before.data()?.stock) || 0 : 0;
      if (p.data.stock !== undefined && p.data.stock !== prevStock) {
        writer.create(db.collection('inventory_movements').doc(), {
          productId: p.id, productName: p.data.nombre, type: 'import',
          before: prevStock, after: p.data.stock, delta: Number(p.data.stock) - prevStock,
          actorEmail: isAdmin.email || null, actorUid: isAdmin.uid, createdAt: now,
        });
      }
    });
    await writer.close();

    await recordAuditLog({
      action: 'IMPORT_PRODUCTS',
      category: 'ADMIN_ACTION',
      details: `Importación CSV: ${created} productos creados, ${updated} actualizados.`,
      adminEmail: isAdmin.email,
      targetId: 'products',
      request,
    });

    return NextResponse.json({ dryRun: false, created, updated, results });
  } catch (error) {
    console.error('[/api/admin/products/import]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
