import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPurchaseHistory, summarizePurchases, toIso } from '../lib/purchase-history.ts';

// Historial de compras (/compras): pagos de Mercado Pago + órdenes de Stripe/anteriores.
const at = (iso: string) => ({ toDate: () => new Date(iso) });

const planPay = (id: string, status: string, extra: Record<string, any> = {}) => ({
  id,
  data: {
    status, type: 'plan', concept: 'Plan Estándar', amount: 80000, dias: 30,
    items: [{ id: 'estandar', nombre: 'Plan Estándar', precio: 80000, cantidad: 1 }],
    createdAt: at('2026-10-24T14:00:00Z'), ...extra,
  },
});

test('oculta los checkouts abandonados y los vencidos', () => {
  const list = buildPurchaseHistory(
    [planPay('fm_open', 'pending'), planPay('fm_exp', 'expired'), planPay('fm_pse', 'pending', { mpPaymentId: 7 })],
    []
  );
  assert.deepEqual(list.map((e) => [e.id, e.estado]), [['fm_pse', 'pending']]);
});

test('pago aprobado: fecha de aprobación, método, transacción y días', () => {
  const [e] = buildPurchaseHistory(
    [planPay('fm_ok', 'approved', { mpPaymentId: 185927705396, method: 'Saldo Mercado Pago', approvedAt: at('2026-10-24T15:26:02Z') })],
    [{ id: 'fm_ok', data: { gateway: 'mercadopago', status: 'paid', total: 80000 } }]
  );
  assert.equal(e.estado, 'paid');
  assert.equal(e.fecha, '2026-10-24T15:26:02.000Z');
  assert.equal(e.metodo, 'Saldo Mercado Pago');
  assert.equal(e.transaccion, '185927705396');
  assert.equal(e.dias, 30);
  assert.equal(e.reembolsado, 0);
});

test('la orden de Mercado Pago no se duplica y aporta el reembolso parcial', () => {
  const list = buildPurchaseHistory(
    [{ id: 'fm_shop', data: { status: 'approved', type: 'products', concept: 'Compra de productos', amount: 50000, mpPaymentId: 9, items: [{ nombre: 'Proteína', precio: 25000, cantidad: 2 }], approvedAt: at('2026-10-20T10:00:00Z') } }],
    [{ id: 'fm_shop', data: { gateway: 'mercadopago', status: 'partially_refunded', refund: { amount: 25000 } } }]
  );
  assert.equal(list.length, 1);
  assert.equal(list[0].estado, 'partially_refunded');
  assert.equal(list[0].reembolsado, 25000);
  assert.equal(list[0].dias, null);
  assert.deepEqual(list[0].items, [{ nombre: 'Proteína', precio: 25000, cantidad: 2 }]);
});

test('reembolso total, contracargo, rechazo y monto alterado', () => {
  const list = buildPurchaseHistory(
    [
      planPay('a', 'refunded', { mpPaymentId: 1 }),
      planPay('b', 'charged_back', { mpPaymentId: 2 }),
      planPay('c', 'rejected', { mpPaymentId: 3 }),
      planPay('d', 'amount_mismatch', { mpPaymentId: 4 }),
    ],
    [{ id: 'a', data: { gateway: 'mercadopago', status: 'refunded', amountRefunded: 80000 } }]
  );
  const byId = Object.fromEntries(list.map((e) => [e.id, e]));
  assert.equal(byId.a.estado, 'refunded');
  assert.equal(byId.a.reembolsado, 80000);
  assert.equal(byId.b.estado, 'charged_back');
  assert.equal(byId.b.reembolsado, 80000);
  assert.equal(byId.c.estado, 'rejected');
  assert.equal(byId.c.reembolsado, 0);
  assert.equal(byId.d.estado, 'review');
});

test('incluye órdenes de Stripe (plan y productos) y ordena de la más reciente a la más antigua', () => {
  const list = buildPurchaseHistory(
    [planPay('fm_new', 'approved', { mpPaymentId: 5, approvedAt: at('2026-10-24T15:00:00Z') })],
    [
      { id: 'pi_plan', data: { type: 'plan', concepto: 'Plan Parejas', total: 120000, fecha: { seconds: Date.parse('2026-09-01T12:00:00Z') / 1000 }, status: 'paid' } },
      { id: 'pi_shop', data: { items: [{ nombre: 'Guantes', precio: 30000, cantidad: 1 }], total: 30000, banco: 'Visa', fecha: at('2026-10-01T12:00:00Z'), status: 'paid' } },
    ]
  );
  assert.deepEqual(list.map((e) => e.id), ['fm_new', 'pi_shop', 'pi_plan']);
  const shop = list[1];
  assert.equal(shop.tipo, 'products');
  assert.equal(shop.concepto, 'Compra en la tienda');
  assert.equal(shop.metodo, 'Visa');
  assert.equal(shop.transaccion, 'pi_shop');
  assert.equal(list[2].tipo, 'plan');
});

test('resumen: cuenta solo lo pagado y descuenta los reembolsos', () => {
  const list = buildPurchaseHistory(
    [
      planPay('ok', 'approved', { mpPaymentId: 1, approvedAt: at('2026-10-24T15:00:00Z') }),
      planPay('rej', 'rejected', { mpPaymentId: 2 }),
      planPay('ref', 'refunded', { mpPaymentId: 3 }),
    ],
    [{ id: 'pi_shop', data: { items: [{ nombre: 'Guantes', precio: 30000, cantidad: 1 }], total: 30000, fecha: at('2026-10-01T12:00:00Z'), status: 'partially_refunded', refund: { amount: 10000 } } }]
  );
  assert.deepEqual(summarizePurchases(list), { compras: 2, totalPagado: 100000, ultimaCompra: '2026-10-24T15:00:00.000Z' });
  assert.deepEqual(summarizePurchases([]), { compras: 0, totalPagado: 0, ultimaCompra: null });
});

test('traduce los ids crudos de medio de pago de registros antiguos', () => {
  const [e] = buildPurchaseHistory([planPay('old', 'approved', { mpPaymentId: 1, method: 'account_money' })], []);
  assert.equal(e.metodo, 'Saldo Mercado Pago');
});

test('toIso acepta Timestamp, {seconds}, {_seconds}, Date y valores inválidos', () => {
  assert.equal(toIso(at('2026-01-02T03:04:05Z')), '2026-01-02T03:04:05.000Z');
  assert.equal(toIso({ seconds: 0.5 }), '1970-01-01T00:00:00.500Z');
  assert.equal(toIso({ _seconds: 1 }), '1970-01-01T00:00:01.000Z');
  assert.equal(toIso(new Date('2026-05-05T00:00:00Z')), '2026-05-05T00:00:00.000Z');
  assert.equal(toIso('no es fecha'), null);
  assert.equal(toIso(null), null);
});
