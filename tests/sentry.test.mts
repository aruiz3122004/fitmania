import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDsn, scrubPath, buildEnvelope } from '../lib/sentry.ts';

// F2-11: reporte a Sentry sin SDK y sin PII.
const DSN = 'https://abc123@o42.ingest.us.sentry.io/4507';

test('interpreta el DSN y arma la URL del envelope', () => {
  assert.deepEqual(parseDsn(DSN), {
    host: 'o42.ingest.us.sentry.io', projectId: '4507', publicKey: 'abc123',
    envelopeUrl: 'https://o42.ingest.us.sentry.io/api/4507/envelope/',
  });
  assert.equal(parseDsn(undefined), null);
  assert.equal(parseDsn('no-es-url'), null);
  assert.equal(parseDsn('http://abc@host/1'), null); // solo https
});

test('la ruta se envía sin query string', () => {
  assert.equal(scrubPath('/pago/resultado?ref=fm_1&payment_id=9#x'), '/pago/resultado');
});

test('el envelope lleva el requestId y no el query string', () => {
  const env = buildEnvelope(DSN, {
    source: 'server', message: 'boom', requestId: 'req-1', path: '/api/x?email=a@b.c', method: 'POST',
  }, new Date('2026-10-24T12:00:00Z'), 'e'.repeat(32));
  const [header, item, event] = env.split('\n').map((l) => JSON.parse(l));
  assert.equal(header.dsn, DSN);
  assert.deepEqual(item, { type: 'event' });
  assert.equal(event.tags.requestId, 'req-1');
  assert.equal(event.request.url, '/api/x');
  assert.ok(!env.includes('a@b.c'));
});
