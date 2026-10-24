import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSafeImageUrl, publicProfileOf } from '../lib/public-profile.ts';

// F1-09: el perfil público solo expone nombre y una foto de origen permitido.
test('solo Cloudinary o imágenes del sitio', () => {
  assert.equal(isSafeImageUrl('https://res.cloudinary.com/demo/image/upload/a.jpg'), true);
  assert.equal(isSafeImageUrl('/Imagenes/Avatares/FitmanNEW.png'), true);
  assert.equal(isSafeImageUrl('https://tracker.example/pixel.gif'), false);
  assert.equal(isSafeImageUrl('javascript:alert(1)'), false);
  assert.equal(isSafeImageUrl('/Imagenes/' + 'a'.repeat(600)), false);
});

test('el perfil público no copia correo, plan ni datos físicos', () => {
  const p = publicProfileOf({ username: 'Ana', photoURL: 'https://evil.example/x.png', email: 'a@b.c', peso: 60 } as any);
  assert.deepEqual(p, { username: 'Ana', photoURL: null });
});
