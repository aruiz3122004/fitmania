import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyReceptionRequest } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit-logger';

/**
 * Ventas en mostrador desde recepción (F3-23).
 * GET  → productos con precio y stock para vender.
 * POST { items: [{ id, cantidad }], paymentMethod, note? } → venta en una transacción:
 *      valida stock (en físico no se puede sobrevender), descuenta, registra la orden
 *      (`channel: 'pos'`) y los movimientos de inventario. El precio lo pone el servidor.
 */
const METHODS = new Set(['efectivo', 'datafono', 'transferencia']);
const DEFAULT_THRESHOLD = 5;

export async function GET(request: NextRequest) {
  const decoded = await verifyReceptionRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  try {
    const snap = await getAdminFirestore().collection('products').select('nombre', 'precio', 'price', 'stock', 'categoria').get();
    const products = snap.docs
      .map((d) => {
        const p = d.data();
        return { id: d.id, nombre: String(p.nombre || d.id), categoria: p.categoria || 'otros', precio: Number(p.precio ?? p.price) || 0, stock: Number(p.stock) || 0 };
      })
      .filter((p) => p.precio > 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return NextResponse.json({ products });
  } catch (error) {
    console.error('[/api/recepcion/pos GET]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const decoded = await verifyReceptionRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const paymentMethod = typeof body?.paymentMethod === 'string' ? body.paymentMethod : '';
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 200) : '';
  const rawItems: unknown = body?.items;
  if (!METHODS.has(paymentMethod)) return NextResponse.json({ error: 'Medio de pago inválido.' }, { status: 400 });
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 30) {
    return NextResponse.json({ error: 'Agrega entre 1 y 30 productos.' }, { status: 400 });
  }

  // Agrupar por producto y validar cantidades.
  const quantities = new Map<string, number>();
  for (const it of rawItems as any[]) {
    const id = typeof it?.id === 'string' ? it.id : '';
    const cantidad = Number(it?.cantidad);
    if (!id || id.includes('/') || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) {
      return NextResponse.json({ error: 'Producto o cantidad inválidos.' }, { status: 400 });
    }
    quantities.set(id, (quantities.get(id) || 0) + cantidad);
  }

  try {
    const db = getAdminFirestore();
    const orderRef = db.collection('orders').doc();
    const result = await db.runTransaction(async (tx) => {
      const ids = Array.from(quantities.keys());
      const refs = ids.map((id) => db.collection('products').doc(id));
      const snaps: FirebaseFirestore.DocumentSnapshot[] = [];
      for (const ref of refs) snaps.push(await tx.get(ref));

      const items: { id: string; nombre: string; precio: number; cantidad: number }[] = [];
      for (let i = 0; i < ids.length; i++) {
        if (!snaps[i].exists) return { error: `Producto no encontrado: ${ids[i]}` };
        const p = snaps[i].data()!;
        const cantidad = quantities.get(ids[i])!;
        const stock = Number(p.stock) || 0;
        if (stock < cantidad) return { error: `Stock insuficiente de ${p.nombre}: quedan ${stock}.` };
        const precio = Number(p.precio ?? p.price) || 0;
        if (precio <= 0) return { error: `${p.nombre} no tiene precio válido.` };
        items.push({ id: ids[i], nombre: p.nombre, precio, cantidad });
      }

      const now = new Date();
      items.forEach((item, i) => {
        const p = snaps[i].data()!;
        const before = Number(p.stock) || 0;
        const after = before - item.cantidad;
        tx.update(refs[i], { stock: after });
        tx.set(db.collection('inventory_movements').doc(), {
          productId: item.id, productName: item.nombre, type: 'pos_sale',
          before, after, delta: -item.cantidad, orderId: orderRef.id,
          actorEmail: decoded.email || null, actorUid: decoded.uid, createdAt: now,
        });
        const threshold = Number.isFinite(Number(p.lowStockThreshold)) && p.lowStockThreshold !== null ? Number(p.lowStockThreshold) : DEFAULT_THRESHOLD;
        if (after <= threshold) {
          tx.set(db.collection('notifications').doc(), {
            tipo: 'low_stock',
            mensaje: `¡Alerta! El producto ${item.nombre} tiene stock crítico: ${after} unidades (venta en mostrador).`,
            id_producto: item.id, leido: false, fecha: now,
          });
        }
      });

      const total = items.reduce((acc, it) => acc + it.precio * it.cantidad, 0);
      tx.set(orderRef, {
        channel: 'pos',
        type: 'products',
        uid: null,
        customerName: 'Venta en mostrador',
        customerEmail: null,
        items,
        total,
        paymentMethod,
        note: note || null,
        soldBy: decoded.email || null,
        soldByUid: decoded.uid,
        fecha: now,
        status: 'paid',
      });
      return { total, items };
    });

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 409 });

    await recordAuditLog({
      action: 'POS_SALE',
      category: 'ADMIN_ACTION',
      details: `Venta en mostrador ${orderRef.id} por ${result.total} COP (${paymentMethod}).`,
      adminEmail: decoded.email,
      actorUid: decoded.uid,
      targetId: orderRef.id,
      request,
    });
    return NextResponse.json({ success: true, orderId: orderRef.id, total: result.total });
  } catch (error) {
    console.error('[/api/recepcion/pos POST]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
