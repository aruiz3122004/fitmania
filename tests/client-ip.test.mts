import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getClientIp } from '../lib/client-ip.ts';

// T-11 / F1-26: la IP confiable es la que adjunta Vercel, no x-forwarded-for.

test('prioriza x-vercel-forwarded-for sobre x-forwarded-for falsificado', () => {
  const headers = new Headers({ 'x-forwarded-for': '6.6.6.6', 'x-vercel-forwarded-for': '1.2.3.4' });
  assert.equal(getClientIp(headers), '1.2.3.4');
});

test('usa cf-connecting-ip si no hay header de Vercel', () => {
  assert.equal(getClientIp(new Headers({ 'cf-connecting-ip': '5.5.5.5', 'x-forwarded-for': '6.6.6.6' })), '5.5.5.5');
});

test('x-forwarded-for solo como último recurso (primer valor)', () => {
  assert.equal(getClientIp(new Headers({ 'x-forwarded-for': '7.7.7.7, 8.8.8.8' })), '7.7.7.7');
  assert.equal(getClientIp(new Headers()), '127.0.0.1');
});
