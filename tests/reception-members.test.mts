import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memberStatus, projectMemberSummary } from '../lib/reception-members.ts';

// F3-05: estado del socio en el directorio de recepción.
const DAY = 86_400_000;
const now = new Date('2026-10-24T12:00:00Z');

test('vigente, por vencer (≤ 5 días), vencido y sin plan', () => {
  assert.deepEqual(memberStatus(new Date(now.getTime() + 20 * DAY), now), { status: 'active', daysLeft: 20 });
  assert.deepEqual(memberStatus(new Date(now.getTime() + 5 * DAY), now), { status: 'expiring', daysLeft: 5 });
  assert.deepEqual(memberStatus(new Date(now.getTime() + 2 * 3_600_000), now), { status: 'expiring', daysLeft: 1 });
  assert.deepEqual(memberStatus(new Date(now.getTime() - 3 * DAY), now), { status: 'expired', daysLeft: -3 });
  assert.deepEqual(memberStatus(null, now), { status: 'none', daysLeft: null });
});

test('la proyección no expone correo ni datos físicos', () => {
  const m = projectMemberSummary('u1', { username: 'Ana', email: 'ana@x.com', peso: 60, altura: 165, plan: { nombre: 'Plan', expira: new Date(now.getTime() + 10 * DAY) } }, now);
  assert.deepEqual(Object.keys(m).sort(), ['daysLeft', 'id', 'photoURL', 'plan', 'status', 'username']);
  assert.equal(m.status, 'active');
});
