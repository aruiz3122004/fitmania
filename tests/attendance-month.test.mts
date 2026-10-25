import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeMonth, previousDateKey } from '../lib/attendance-month.ts';

// F3-01: resumen mensual de asistencia.
const days = [
  { date: '2026-10-01', visits: 10, uniqueMembers: 8, byHour: { '06': 4, '18': 6 } },
  { date: '2026-10-02', visits: 0, uniqueMembers: 0, byHour: {} },
  { date: '2026-10-03', visits: 20, uniqueMembers: 15, byHour: { '06': 5, '18': 15 } },
  { date: '2026-09-30', visits: 99, uniqueMembers: 99, byHour: { '07': 99 } }, // otro mes
];

test('suma visitas, media por día cerrado, hora pico y día con más visitas', () => {
  const s = summarizeMonth('2026-10', days, 3);
  assert.equal(s.visits, 30);
  assert.equal(s.uniqueMemberDays, 23);
  assert.equal(s.avgVisitsPerDay, 10);
  assert.equal(s.peakHour, '18');
  assert.deepEqual(s.byHour, { '06': 9, '18': 21 });
  assert.deepEqual(s.busiestDay, { date: '2026-10-03', visits: 20 });
});

test('mes sin ingresos', () => {
  const s = summarizeMonth('2026-11', [], 0);
  assert.equal(s.avgVisitsPerDay, 0);
  assert.equal(s.peakHour, null);
  assert.equal(s.busiestDay, null);
});

test('día anterior cruzando meses y años', () => {
  assert.equal(previousDateKey('2026-11-01'), '2026-10-31');
  assert.equal(previousDateKey('2027-01-01'), '2026-12-31');
  assert.equal(previousDateKey('2026-03-01', 3), '2026-02-26');
});
