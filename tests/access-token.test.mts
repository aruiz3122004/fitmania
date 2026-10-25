import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

// F2-05: pase de acceso firmado. Claves efímeras generadas para la prueba.
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
process.env.QR_SIGNING_PRIVATE_KEY = Buffer.from(privateKey.export({ type: 'pkcs8', format: 'pem' })).toString('base64');
process.env.NEXT_PUBLIC_QR_PUBLIC_KEY = Buffer.from(publicKey.export({ type: 'spki', format: 'der' })).toString('base64');

const server = await import('../lib/access-token.ts');
const client = await import('../lib/access-token-client.ts');

const member = { uid: 'socio-1', n: 'Ana', p: 'Mensual', pe: Date.now() + 86_400_000 };

test('el servidor verifica un pase vigente', () => {
  const token = server.createAccessToken(member, 300)!;
  const result = server.verifyAccessToken(token);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.payload.uid, 'socio-1');
});

test('el navegador verifica el mismo pase sin red (Web Crypto)', async () => {
  const token = server.createAccessToken(member, 300)!;
  const result = await client.verifyPassOffline(token);
  assert.equal(result.ok, true);
});

test('un pase alterado se rechaza en servidor y cliente', async () => {
  const token = server.createAccessToken(member, 300)!;
  const [prefix, payload, sig] = [token.slice(0, 4), ...token.slice(4).split('.')];
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), uid: 'otro' })).toString('base64url');
  const tampered = `${prefix}${forged}.${sig}`;
  assert.deepEqual(server.verifyAccessToken(tampered), { ok: false, reason: 'signature' });
  assert.equal((await client.verifyPassOffline(tampered)).ok, false);
});

test('un pase vencido se rechaza', async () => {
  const token = server.createAccessToken(member, -1)!;
  assert.deepEqual(server.verifyAccessToken(token), { ok: false, reason: 'expired' });
  assert.equal((await client.verifyPassOffline(token)).ok, false);
});

test('un UID plano no es un pase firmado', () => {
  assert.deepEqual(server.verifyAccessToken('socio-1'), { ok: false, reason: 'format' });
});
