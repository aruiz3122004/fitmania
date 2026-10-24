import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideTransition, planSale, restockUnits, reversalExpiry } from '../lib/payments/transitions.ts';

// F1-28: transiciones de estado del webhook de Mercado Pago.
const mp = (over: Partial<{ id: number; status: string; transaction_amount: number; currency_id: string }> = {}) => ({
  id: 111, status: 'approved', transaction_amount: 80000, currency_id: 'COP', ...over,
});
const pending = { status: 'pending', amount: 80000 };

test('aprobado desde pending o rejected aplica el efecto', () => {
  assert.deepEqual(decideTransition(pending, mp(), 'approved'), { action: 'approve' });
  assert.deepEqual(decideTransition({ status: 'rejected', amount: 80000 }, mp(), 'approved'), { action: 'approve' });
});

test('idempotencia: un aviso repetido de un pago ya aprobado no hace nada', () => {
  const approved = { status: 'approved', amount: 80000, mpPaymentId: 111 };
  assert.deepEqual(decideTransition(approved, mp(), 'approved'), { action: 'already_approved' });
  // Un segundo pago aprobado del mismo checkout tampoco activa dos veces.
  assert.deepEqual(decideTransition(approved, mp({ id: 222 }), 'approved'), { action: 'already_approved' });
});

test('monto alterado: no se activa nada y se alerta solo la primera vez', () => {
  assert.deepEqual(decideTransition(pending, mp({ transaction_amount: 1000 }), 'approved'), { action: 'amount_mismatch', alert: true });
  assert.deepEqual(decideTransition(pending, mp({ currency_id: 'USD' }), 'approved'), { action: 'amount_mismatch', alert: true });
  assert.deepEqual(
    decideTransition({ status: 'amount_mismatch', amount: 80000 }, mp({ transaction_amount: 1000 }), 'approved'),
    { action: 'amount_mismatch', alert: false }
  );
  // Sobre un pago ya aprobado no se cambia el estado.
  assert.deepEqual(
    decideTransition({ status: 'approved', amount: 80000, mpPaymentId: 111 }, mp({ transaction_amount: 1 }), 'approved'),
    { action: 'amount_mismatch', alert: false }
  );
});

test('rechazo después de aprobado se ignora', () => {
  const approved = { status: 'approved', amount: 80000, mpPaymentId: 111 };
  assert.deepEqual(decideTransition(approved, mp({ id: 222, status: 'rejected' }), 'rejected'), { action: 'ignore' });
  assert.deepEqual(decideTransition(pending, mp({ status: 'rejected' }), 'rejected'), { action: 'reject' });
});

test('reintento: rechazado y luego aprobado en el mismo checkout', () => {
  assert.deepEqual(decideTransition(pending, mp({ id: 1, status: 'rejected' }), 'rejected'), { action: 'reject' });
  assert.deepEqual(decideTransition({ status: 'rejected', amount: 80000 }, mp({ id: 2 }), 'approved'), { action: 'approve' });
  assert.deepEqual(
    decideTransition({ status: 'approved', amount: 80000, mpPaymentId: 2 }, mp({ id: 2 }), 'approved'),
    { action: 'already_approved' }
  );
});

test('reembolso de un pago que no aplicó se ignora', () => {
  // Pago nunca aprobado.
  assert.deepEqual(decideTransition(pending, mp({ status: 'refunded' }), 'reversed'), { action: 'ignore' });
  // Reembolso de otro intento (no el que activó el efecto).
  const approved = { status: 'approved', amount: 80000, mpPaymentId: 111 };
  assert.deepEqual(decideTransition(approved, mp({ id: 999, status: 'refunded' }), 'reversed'), { action: 'ignore' });
  // Reembolso ya aplicado: repetir el aviso no revierte dos veces.
  assert.deepEqual(decideTransition({ status: 'refunded', amount: 80000, mpPaymentId: 111 }, mp({ status: 'refunded' }), 'reversed'), { action: 'ignore' });
});

test('reembolso o contracargo del pago que aplicó revierte', () => {
  const approved = { status: 'approved', amount: 80000, mpPaymentId: 111 };
  assert.deepEqual(decideTransition(approved, mp({ status: 'refunded' }), 'reversed'), { action: 'reverse', finalStatus: 'refunded' });
  assert.deepEqual(decideTransition(approved, mp({ status: 'charged_back' }), 'reversed'), { action: 'reverse', finalStatus: 'charged_back' });
});

test('pendiente: solo se actualiza mientras el pago siga pending', () => {
  assert.deepEqual(decideTransition(pending, mp({ status: 'in_process' }), 'pending'), { action: 'pending', touch: true });
  assert.deepEqual(
    decideTransition({ status: 'approved', amount: 80000, mpPaymentId: 111 }, mp({ status: 'in_process' }), 'pending'),
    { action: 'pending', touch: false }
  );
});

const items = [
  { id: 'creatina', nombre: 'Creatina', precio: 50000, cantidad: 2 },
  { id: 'proteina', nombre: 'Proteína', precio: 120000, cantidad: 3 },
];

test('venta con stock suficiente descuenta todo', () => {
  const changes = planSale(items, { creatina: 10, proteina: 3 });
  assert.deepEqual(changes, [
    { id: 'creatina', before: 10, after: 8, deducted: 2, oversold: 0 },
    { id: 'proteina', before: 3, after: 0, deducted: 3, oversold: 0 },
  ]);
});

test('sobreventa (F1-20): solo se descuenta lo que hay y el resto queda para reembolsar', () => {
  const changes = planSale(items, { creatina: 1, proteina: 0 });
  assert.deepEqual(changes, [
    { id: 'creatina', before: 1, after: 0, deducted: 1, oversold: 1 },
    { id: 'proteina', before: 0, after: 0, deducted: 0, oversold: 3 },
  ]);
  // Stock negativo heredado se trata como 0.
  assert.deepEqual(planSale([items[0]], { creatina: -4 })[0], { id: 'creatina', before: 0, after: 0, deducted: 0, oversold: 2 });
});

test('reembolso total tras sobreventa repone solo lo que salió del inventario', () => {
  const changes = planSale(items, { creatina: 1, proteina: 0 });
  const stockApplied = Object.fromEntries(changes.map((c) => [c.id, c.deducted]));
  assert.deepEqual(restockUnits(items, stockApplied), { creatina: 1, proteina: 0 });
});

test('ventas anteriores a stockApplied reponen la cantidad completa', () => {
  assert.deepEqual(restockUnits(items, undefined), { creatina: 2, proteina: 3 });
});

test('revertir un plan descuenta sus días del vencimiento', () => {
  const expira = new Date('2026-12-31T12:00:00Z');
  assert.equal(reversalExpiry(expira, 30).toISOString(), '2026-12-01T12:00:00.000Z');
});
