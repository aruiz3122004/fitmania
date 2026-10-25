import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTier } from '../lib/plan-theme.ts';

test('el tipo de plan sale del planId', () => {
  assert.equal(planTier({ planId: 'parejas', nombre: 'Lo que sea' }), 'parejas');
  assert.equal(planTier({ planId: 'dosenuno' }), 'dosenuno');
  assert.equal(planTier({ planId: 'estandar', nombre: 'Plan Parejas' }), 'estandar');
});

test('sin planId se usa el nombre, como en firestore.rules', () => {
  assert.equal(planTier({ nombre: 'Plan Parejas' }), 'parejas');
  assert.equal(planTier({ nombre: 'Plan Dos en Uno' }), 'dosenuno');
  assert.equal(planTier({ nombre: 'Plan asignado por administración' }), 'estandar');
  assert.equal(planTier({ nombre: 'Plan Todos los días' }), 'estandar');
  assert.equal(planTier(null), 'estandar');
});
