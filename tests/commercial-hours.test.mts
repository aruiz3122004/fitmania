import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWithinCommercialHours } from '../lib/commercial-hours.ts';

// Ley 2300 de 2023: horas en Colombia (UTC-5). 2026-10-19 es lunes.
const at = (iso: string) => new Date(iso);

test('lunes a viernes de 7:00 a 19:00', () => {
  assert.equal(isWithinCommercialHours(at('2026-10-19T12:00:00Z')), true);  // lun 07:00
  assert.equal(isWithinCommercialHours(at('2026-10-19T11:59:00Z')), false); // lun 06:59
  assert.equal(isWithinCommercialHours(at('2026-10-19T23:59:00Z')), true);  // lun 18:59
  assert.equal(isWithinCommercialHours(at('2026-10-20T00:00:00Z')), false); // lun 19:00
});

test('sábado de 8:00 a 15:00', () => {
  assert.equal(isWithinCommercialHours(at('2026-10-24T13:00:00Z')), true);  // sáb 08:00
  assert.equal(isWithinCommercialHours(at('2026-10-24T20:00:00Z')), false); // sáb 15:00
});

test('domingo nunca', () => {
  assert.equal(isWithinCommercialHours(at('2026-10-25T16:00:00Z')), false); // dom 11:00
});
