import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanPaymentId, returnState } from '../lib/payments/return-state.ts';

// /pago/resultado: qué ve el cliente al volver de Mercado Pago.
test('cleanPaymentId descarta el texto "null" y valores no numéricos', () => {
  assert.equal(cleanPaymentId('185927705396'), '185927705396');
  assert.equal(cleanPaymentId('null'), '');
  assert.equal(cleanPaymentId(null), '');
  assert.equal(cleanPaymentId(' 123 '), '123');
  assert.equal(cleanPaymentId('abc'), '');
});

test('aprobado y fallidos', () => {
  assert.equal(returnState({ status: 'approved', urlPaymentId: '', serverPaymentId: 1, attempt: 0 }), 'exitoso');
  for (const status of ['rejected', 'refunded', 'charged_back', 'expired']) {
    assert.equal(returnState({ status, urlPaymentId: '1', serverPaymentId: 1, attempt: 0 }), 'fallido');
  }
});

test('volver sin pagar: pago no completado, sin reintentos', () => {
  assert.equal(returnState({ status: 'pending', urlPaymentId: '', serverPaymentId: null, attempt: 0 }), 'incompleto');
});

test('PSE o Efecty pendientes: reintenta y luego "en proceso"', () => {
  assert.equal(returnState({ status: 'pending', urlPaymentId: '42', serverPaymentId: null, attempt: 0 }), 'reintentar');
  assert.equal(returnState({ status: 'pending', urlPaymentId: '42', serverPaymentId: 42, attempt: 5 }), 'pendiente');
  // El servidor ya conoce un pago (p. ej. llegó el webhook) aunque la URL no traiga id.
  assert.equal(returnState({ status: 'pending', urlPaymentId: '', serverPaymentId: 42, attempt: 0 }), 'reintentar');
});

test('sin respuesta del servidor: "en proceso"', () => {
  assert.equal(returnState({ status: undefined, urlPaymentId: '', serverPaymentId: null, attempt: 0 }), 'pendiente');
});
