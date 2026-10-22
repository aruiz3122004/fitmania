import type { Firestore } from 'firebase-admin/firestore';

/**
 * Precio de un checkout calculado SIEMPRE en el servidor (T-07, auditoría C-5).
 * El cliente solo indica qué compra (plan o ítems del carrito), nunca montos.
 *
 * El resultado es la "foto" que se guarda con el pago: el webhook aplica estos
 * precios y días aunque el admin cambie el plan o el producto mientras tanto.
 */
export interface CheckoutItem {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

export type CheckoutSnapshot =
  | { type: 'plan'; planId: string; concept: string; amount: number; dias: number; items: CheckoutItem[] }
  | { type: 'products'; planId: null; concept: string; amount: number; dias: null; items: CheckoutItem[] };

export class CheckoutError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function priceCheckout(
  db: Firestore,
  input: { planId?: unknown; items?: unknown }
): Promise<CheckoutSnapshot> {
  if (input.planId) {
    const planId = String(input.planId);
    const planDoc = await db.collection('planes').doc(planId).get();
    if (!planDoc.exists) throw new CheckoutError('Plan no encontrado', 404);
    const plan = planDoc.data()!;
    const amount = Number(plan.price) || 0;
    if (amount <= 0) throw new CheckoutError('Monto de pago no válido');
    const concept = String(plan.name || 'Plan Fitmania');
    return {
      type: 'plan',
      planId,
      concept,
      amount,
      // Duración definida por el plan (`days`, editable en el panel); 30 si falta.
      dias: Number(plan.days) || 30,
      items: [{ id: planId, nombre: concept, precio: amount, cantidad: 1 }],
    };
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new CheckoutError('Solicitud de pago sin plan ni productos válidos.');
  }
  if (input.items.length > 50) throw new CheckoutError('Demasiados productos en un solo pago.');

  const items: CheckoutItem[] = [];
  for (const raw of input.items as any[]) {
    const id = String(raw?.id ?? '').trim().toLowerCase();
    const cantidad = Number(raw?.cantidad);
    // Cantidad: entero >= 1 con tope razonable.
    if (!id || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) {
      throw new CheckoutError('Cantidad de producto no válida.');
    }
    const productDoc = await db.collection('products').doc(id).get();
    if (!productDoc.exists) throw new CheckoutError(`Producto no encontrado: ${id}`);
    const product = productDoc.data()!;
    // Los productos guardan el precio en `precio`; `price` queda como respaldo.
    const precio = Number(product.precio ?? product.price) || 0;
    if (precio <= 0) throw new CheckoutError(`Precio de producto no válido: ${id}`);
    if ((Number(product.stock) || 0) < cantidad) {
      throw new CheckoutError(`Stock insuficiente para: ${product.nombre || id}`);
    }
    const existing = items.find((it) => it.id === id);
    if (existing) existing.cantidad += cantidad;
    else items.push({ id, nombre: String(product.nombre || id), precio, cantidad });
  }

  const amount = items.reduce((acc, it) => acc + it.precio * it.cantidad, 0);
  if (amount <= 0) throw new CheckoutError('Monto de pago no válido');
  return { type: 'products', planId: null, concept: 'Compra de productos - Fitmania Shop', amount, dias: null, items };
}
