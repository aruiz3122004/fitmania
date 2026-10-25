import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyWebhookSignature, classifyPaymentStatus } from '../lib/payments/mercadopago.ts';

// F1-19: firma `x-signature` de los webhooks de Mercado Pago.
const secret = 'secreto-de-prueba';
const sign = (manifest: string) => createHmac('sha256', secret).update(manifest).digest('hex');

test('acepta una firma válida', () => {
  const v1 = sign('id:123456;request-id:req-1;ts:1704908010;');
  assert.equal(
    verifyWebhookSignature({ xSignature: `ts=1704908010,v1=${v1}`, xRequestId: 'req-1', dataId: '123456', secret }),
    true
  );
});

test('rechaza otro id, otro secreto o una firma alterada', () => {
  const v1 = sign('id:123456;request-id:req-1;ts:1704908010;');
  const header = `ts=1704908010,v1=${v1}`;
  assert.equal(verifyWebhookSignature({ xSignature: header, xRequestId: 'req-1', dataId: '999', secret }), false);
  assert.equal(verifyWebhookSignature({ xSignature: header, xRequestId: 'req-1', dataId: '123456', secret: 'otro' }), false);
  assert.equal(verifyWebhookSignature({ xSignature: `ts=1704908011,v1=${v1}`, xRequestId: 'req-1', dataId: '123456', secret }), false);
});

test('rechaza cabeceras ausentes o mal formadas', () => {
  assert.equal(verifyWebhookSignature({ xSignature: null, xRequestId: 'r', dataId: '1', secret }), false);
  assert.equal(verifyWebhookSignature({ xSignature: 'ts=1', xRequestId: 'r', dataId: '1', secret }), false);
  assert.equal(verifyWebhookSignature({ xSignature: 'basura', xRequestId: 'r', dataId: '1', secret }), false);
});

test('id alfanumérico en minúsculas y partes ausentes omitidas', () => {
  const v1 = sign('id:abc123;ts:1704908010;');
  assert.equal(
    verifyWebhookSignature({ xSignature: `ts=1704908010,v1=${v1}`, xRequestId: null, dataId: 'ABC123', secret }),
    true
  );
});

test('clasifica los estados de Mercado Pago', () => {
  assert.equal(classifyPaymentStatus('approved'), 'approved');
  assert.equal(classifyPaymentStatus('in_mediation'), 'approved');
  assert.equal(classifyPaymentStatus('rejected'), 'rejected');
  assert.equal(classifyPaymentStatus('cancelled'), 'rejected');
  assert.equal(classifyPaymentStatus('refunded'), 'reversed');
  assert.equal(classifyPaymentStatus('charged_back'), 'reversed');
  // PSE en proceso, Efecty sin pagar o un estado nuevo: nunca activa nada.
  for (const s of ['pending', 'in_process', 'authorized', 'estado_nuevo']) {
    assert.equal(classifyPaymentStatus(s), 'pending');
  }
});
