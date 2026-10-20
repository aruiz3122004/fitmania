import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyReceptionRequest } from '@/lib/auth-helpers';

/**
 * Inventario para recepción (F3-06 / F3-07).
 *
 * GET  → stock de solo lectura (nombre, categoría, stock y umbral; sin precios).
 * POST → reporta un CONTEO FÍSICO. No modifica el stock: crea `inventory_counts`
 *        y una notificación al admin, que decide si ajusta (con auditoría).
 */
const DEFAULT_THRESHOLD = 5;

export async function GET(request: NextRequest) {
  const decoded = await verifyReceptionRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const snap = await getAdminFirestore()
      .collection('products')
      .select('nombre', 'categoria', 'stock', 'lowStockThreshold')
      .get();

    const products = snap.docs
      .map((doc) => {
        const d = doc.data();
        const stock = Number(d.stock) || 0;
        const threshold = Number.isFinite(Number(d.lowStockThreshold)) && d.lowStockThreshold !== null
          ? Number(d.lowStockThreshold)
          : DEFAULT_THRESHOLD;
        return {
          id: doc.id,
          nombre: String(d.nombre || doc.id),
          categoria: String(d.categoria || 'otros'),
          stock,
          lowStockThreshold: threshold,
          low: stock <= threshold,
        };
      })
      // Primero los que están en alerta, luego por nombre.
      .sort((a, b) => Number(b.low) - Number(a.low) || a.nombre.localeCompare(b.nombre, 'es'));

    return NextResponse.json({ products });
  } catch (error) {
    console.error('[/api/recepcion/inventory GET]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const decoded = await verifyReceptionRequest(request);
  if (!decoded) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });

  try {
    const body = await request.json().catch(() => null);
    const productId = typeof body?.productId === 'string' ? body.productId : '';
    const counted = Number(body?.counted);
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 300) : '';

    if (!productId || productId.includes('/') || productId.length > 150) {
      return NextResponse.json({ error: 'Producto inválido.' }, { status: 400 });
    }
    if (!Number.isInteger(counted) || counted < 0 || counted > 1_000_000) {
      return NextResponse.json({ error: 'El conteo debe ser un número entero mayor o igual a 0.' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const productSnap = await db.collection('products').doc(productId).get();
    if (!productSnap.exists) return NextResponse.json({ error: 'Producto no encontrado.' }, { status: 404 });

    const product = productSnap.data() || {};
    const systemStock = Number(product.stock) || 0;
    const difference = counted - systemStock;
    const now = new Date();

    const batch = db.batch();
    const countRef = db.collection('inventory_counts').doc();
    batch.set(countRef, {
      productId,
      productName: product.nombre || productId,
      counted,
      systemStock,
      difference,
      note: note || null,
      status: 'pending', // el admin lo aprueba o descarta
      reportedBy: decoded.email || null,
      reportedByUid: decoded.uid,
      createdAt: now,
    });
    batch.set(db.collection('notifications').doc(), {
      tipo: 'inventory_count',
      mensaje: `Recepción contó ${counted} de ${product.nombre || productId} (sistema: ${systemStock}${difference ? `, diferencia ${difference > 0 ? '+' : ''}${difference}` : ', sin diferencia'}).`,
      id_producto: productId,
      id_conteo: countRef.id,
      leido: false,
      fecha: now,
    });
    await batch.commit();

    return NextResponse.json({ success: true, countId: countRef.id, systemStock, difference });
  } catch (error) {
    console.error('[/api/recepcion/inventory POST]', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
