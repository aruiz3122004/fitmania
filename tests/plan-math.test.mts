import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRenewalExpiry } from '../lib/plan-math.ts';

// F1-28 / B3 / F3-25: duración del plan al renovar.
const DAY = 86_400_000;
const now = new Date('2026-11-01T12:00:00Z');

test('plan vigente: los días se suman al vencimiento actual', () => {
  const existing = new Date(now.getTime() + 10 * DAY);
  const result = computeRenewalExpiry({ existingExpira: existing, dias: 30, now });
  assert.equal(Math.round((result.getTime() - existing.getTime()) / DAY), 30);
});

test('plan vencido: los días cuentan desde hoy (no se recuperan días perdidos)', () => {
  const existing = new Date(now.getTime() - 5 * DAY);
  const result = computeRenewalExpiry({ existingExpira: existing, dias: 30, now });
  assert.equal(Math.round((result.getTime() - now.getTime()) / DAY), 30);
});

test('sin plan previo: desde hoy', () => {
  const result = computeRenewalExpiry({ existingExpira: null, dias: 60, now });
  assert.equal(Math.round((result.getTime() - now.getTime()) / DAY), 60);
});

test('plan congelado: suma también los días congelados a favor', () => {
  const result = computeRenewalExpiry({ existingExpira: now, dias: 30, frozenMs: 12 * DAY, now });
  assert.equal(Math.round((result.getTime() - now.getTime()) / DAY), 42);
});
