import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGateToken, verifyGateToken, timingSafeEqualStrings } from '../lib/gate-token.ts';

// F1-12: la puerta de los paneles solo acepta tokens firmados con la llave correcta.
const SECRET = 'llave-de-prueba';

test('un token recién emitido es válido para su scope', async () => {
  const token = await createGateToken('admin', SECRET, 60);
  assert.equal(await verifyGateToken('admin', SECRET, token), true);
});

test('rechaza el literal "true" y tokens vacíos (bypass anterior)', async () => {
  assert.equal(await verifyGateToken('admin', SECRET, 'true'), false);
  assert.equal(await verifyGateToken('admin', SECRET, undefined), false);
  assert.equal(await verifyGateToken('admin', SECRET, ''), false);
});

test('rechaza un token de otro scope o firmado con otra llave', async () => {
  const token = await createGateToken('admin', SECRET, 60);
  assert.equal(await verifyGateToken('recepcion', SECRET, token), false);
  assert.equal(await verifyGateToken('admin', 'otra-llave', token), false);
});

test('rechaza si se altera la expiración', async () => {
  const token = await createGateToken('admin', SECRET, 60);
  const [, signature] = token.split('.');
  assert.equal(await verifyGateToken('admin', SECRET, `9999999999.${signature}`), false);
});

test('rechaza tokens vencidos', async () => {
  const token = await createGateToken('admin', SECRET, -1);
  assert.equal(await verifyGateToken('admin', SECRET, token), false);
});

test('comparación en tiempo constante', () => {
  assert.equal(timingSafeEqualStrings('abc', 'abc'), true);
  assert.equal(timingSafeEqualStrings('abc', 'abd'), false);
  assert.equal(timingSafeEqualStrings('abc', 'abcd'), false);
});
