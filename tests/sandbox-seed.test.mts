import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSandboxSeed, SANDBOX_COLLECTIONS } from '../lib/sandbox/seed.ts';

const now = new Date('2026-10-25T15:00:00Z');
const seed = buildSandboxSeed(now);
const inCol = (col: string) => seed.docs.filter((d) => d.path.split('/')[0] === col && d.path.split('/').length === 2);

test('es determinista: dos reinicios dejan lo mismo', () => {
  assert.deepEqual(buildSandboxSeed(now), seed);
});

test('no repite documentos y todo cae en colecciones que el reinicio vacía', () => {
  const paths = seed.docs.map((d) => d.path);
  assert.equal(new Set(paths).size, paths.length);
  for (const p of paths) assert.ok((SANDBOX_COLLECTIONS as readonly string[]).includes(p.split('/')[0]), p);
});

test('cada socio de ejemplo tiene su cuenta y su perfil público', () => {
  const users = inCol('users').map((d) => d.path.slice(6));
  const accounts = new Set(seed.authUsers.map((u) => u.uid));
  for (const uid of users) assert.ok(accounts.has(uid), uid);
  assert.equal(seed.authUsers.every((u) => u.email.endsWith('@sandbox.fitmania.test')), true);
});

test('catálogo con los tres tipos de plan y un producto agotado', () => {
  assert.deepEqual(inCol('planes').map((d) => d.path).sort(), ['planes/dosenuno', 'planes/estandar', 'planes/parejas']);
  assert.ok(inCol('products').some((d) => d.data.stock === 0));
});

test('el foro tiene dos páginas y las estadísticas cuadran con los ingresos', () => {
  assert.equal(inCol('posts').length, 12);
  const entries = inCol('entry_logs');
  const visits = inCol('daily_stats').reduce((n, d) => n + Number(d.data.visits), 0);
  assert.equal(visits, entries.length);
  assert.equal(inCol('checkIns').length, entries.length);
  // Todo en las últimas 3 semanas.
  for (const e of entries) {
    const t = (e.data.timestamp as Date).getTime();
    assert.ok(t < now.getTime() && t > now.getTime() - 22 * 86_400_000);
  }
});

test('cada venta tiene su orden y su pago aprobado con el mismo total', () => {
  for (const order of inCol('orders')) {
    const pay = seed.docs.find((d) => d.path === `payments/${order.path.slice(7)}`);
    assert.ok(pay, order.path);
    assert.equal(pay!.data.amount, order.data.total);
    assert.equal(pay!.data.status, 'approved');
  }
});
