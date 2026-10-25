import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addSession,
  codeMatches,
  generateCode,
  generateRecoveryCodes,
  hashCode,
  hashRecoveryCode,
  MAX_SESSIONS,
  newSalt,
  sessionSatisfiesMfa,
} from '../lib/mfa.ts';

// Verificación en dos pasos por correo: códigos, recuperación y sesiones verificadas.

test('el código tiene 6 dígitos y solo coincide con su hash', () => {
  for (let i = 0; i < 50; i++) assert.match(generateCode(), /^\d{6}$/);
  const salt = newSalt();
  const hash = hashCode('012345', salt);
  assert.equal(codeMatches('012345', salt, hash), true);
  assert.equal(codeMatches(' 012 345 ', salt, hash), true);
  assert.equal(codeMatches('012346', salt, hash), false);
  assert.equal(codeMatches('12345', salt, hash), false);
  assert.equal(codeMatches('abcdef', salt, hash), false);
  // Otra sal, otro hash: el mismo código no sirve para otro desafío.
  assert.equal(codeMatches('012345', newSalt(), hash), false);
});

test('los códigos de recuperación son únicos, legibles y no dependen de mayúsculas ni guiones', () => {
  const codes = generateRecoveryCodes();
  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8);
  for (const c of codes) assert.match(c, /^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/);
  const [first] = codes;
  assert.equal(hashRecoveryCode('uid1', first), hashRecoveryCode('uid1', first.toLowerCase().replace('-', ' ')));
  assert.notEqual(hashRecoveryCode('uid1', first), hashRecoveryCode('uid2', first));
});

test('addSession no duplica y conserva solo las sesiones más recientes', () => {
  assert.deepEqual(addSession(undefined, 100), [100]);
  assert.deepEqual(addSession([100, 200], 100), [200, 100]);
  assert.deepEqual(addSession(['x', 1.5, 300], 400), [300, 400]);
  const many = Array.from({ length: MAX_SESSIONS }, (_, i) => i);
  const out = addSession(many, 999);
  assert.equal(out.length, MAX_SESSIONS);
  assert.equal(out[0], 1);
  assert.equal(out.at(-1), 999);
});

test('sessionSatisfiesMfa: opcional, por sesión y compatible con TOTP', () => {
  assert.equal(sessionSatisfiesMfa(null, 100), true);
  assert.equal(sessionSatisfiesMfa({ enabled: false, sessions: [] }, 100), true);
  assert.equal(sessionSatisfiesMfa({ enabled: true, sessions: [100] }, 100), true);
  assert.equal(sessionSatisfiesMfa({ enabled: true, sessions: [100] }, 101), false);
  assert.equal(sessionSatisfiesMfa({ enabled: true, sessions: [100] }, undefined), false);
  assert.equal(sessionSatisfiesMfa({ enabled: true, sessions: [] }, 101, 'totp'), true);
});
