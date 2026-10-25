import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ValidationError,
  parseDocId,
  parsePlanCreate,
  parsePlanUpdate,
  parseProductCreate,
  parseProductUpdate,
} from '../lib/admin-validation.ts';

// F1-04: lista blanca de campos (antes mass assignment con `...data`).

test('un plan nuevo exige nombre, precio y días', () => {
  assert.throws(() => parsePlanCreate({ name: 'Mensual', price: 80000 }), ValidationError);
  const plan = parsePlanCreate({ name: ' Mensual ', price: '80000', days: 30 });
  assert.deepEqual(plan, { name: 'Mensual', price: 80000, days: 30 });
});

test('los campos desconocidos se descartan (sin mass assignment)', () => {
  const update = parsePlanUpdate({ price: 90000, admin: true, createdAt: 'x', __proto__: { evil: 1 } });
  assert.deepEqual(Object.keys(update), ['price']);
});

test('tipos inválidos se rechazan', () => {
  assert.throws(() => parsePlanUpdate({ days: 0 }), ValidationError);
  assert.throws(() => parsePlanUpdate({ days: 3.5 }), ValidationError);
  assert.throws(() => parseProductUpdate({ stock: -1 }), ValidationError);
  assert.throws(() => parseProductUpdate({ colores: 'rojo' }), ValidationError);
  assert.throws(() => parseProductCreate({ nombre: 'x'.repeat(121), precio: 1 }), ValidationError);
});

test('producto válido con umbral de stock', () => {
  const product = parseProductCreate({ nombre: 'Proteína', precio: 120000, stock: 10, lowStockThreshold: 3, id: 'ignorado' });
  assert.deepEqual(product, { nombre: 'Proteína', precio: 120000, stock: 10, lowStockThreshold: 3 });
});

test('IDs de documento', () => {
  assert.equal(parseDocId('proteína-whey'), 'proteína-whey');
  assert.throws(() => parseDocId('a/b'), ValidationError);
  assert.throws(() => parseDocId('..'), ValidationError);
  assert.throws(() => parseDocId(''), ValidationError);
});
