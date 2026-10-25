import { test } from 'node:test';
import assert from 'node:assert/strict';

const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
};
const { enqueueOfflineEntry, offlineEntriesCsv, pendingOfflineEntries } = await import('../lib/offline-entries.ts');

test('el respaldo CSV lista los ingresos pendientes con comillas escapadas', () => {
  enqueueOfflineEntry('u1', 'Ana "La" Pérez');
  const lines = offlineEntriesCsv().split('\n');
  assert.equal(lines[0], 'Fecha y hora,Socio,UID,ID del ingreso');
  assert.equal(lines.length, 1 + pendingOfflineEntries().length);
  assert.match(lines[1], /"Ana ""La"" Pérez","u1"/);
});
