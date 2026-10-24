import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditChanges, normalizeAuditValue } from '../lib/audit-diff.ts';

// F1-26: la auditoría guarda solo lo que cambió.
test('solo los campos que cambiaron, con valor anterior y nuevo', () => {
  const before = { price: 80000, days: 30, name: 'Plan Estandar' };
  assert.deepEqual(auditChanges(before, { price: 90000, days: 30 }), { price: { before: 80000, after: 90000 } });
});

test('campo nuevo: antes es null', () => {
  assert.deepEqual(auditChanges({}, { badge: 'NUEVO' }), { badge: { before: null, after: 'NUEVO' } });
  assert.deepEqual(auditChanges(null, { stock: 5 }), { stock: { before: null, after: 5 } });
});

test('ignora updatedAt y compara fechas y Timestamps por valor', () => {
  const d = new Date('2026-10-24T12:00:00Z');
  const ts = { toDate: () => new Date(d) };
  assert.deepEqual(auditChanges({ expira: ts, updatedAt: 1 }, { expira: d, updatedAt: 2 }), {});
});

test('objetos anidados (plan) sin importar el orden de las claves', () => {
  const plan = { nombre: 'A', expira: new Date('2026-12-01T00:00:00Z') };
  assert.deepEqual(auditChanges({ plan }, { plan: { expira: new Date('2026-12-01T00:00:00Z'), nombre: 'A' } }), {});
  const changed = auditChanges({ plan }, { plan: { ...plan, nombre: 'B' } });
  assert.deepEqual(Object.keys(changed), ['plan']);
});

test('normaliza Timestamps serializados del Admin SDK', () => {
  assert.equal(normalizeAuditValue({ _seconds: 0, _nanoseconds: 0 }), '1970-01-01T00:00:00.000Z');
});
