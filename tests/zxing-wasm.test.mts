import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// El escáner QR de recepción carga public/vendor/zxing/zxing_reader.wasm (la CSP no
// permite jsDelivr). Si se actualiza zxing-wasm, hay que volver a copiar el archivo:
//   cp node_modules/zxing-wasm/dist/reader/zxing_reader.wasm public/vendor/zxing/
test('el .wasm servido coincide con el de zxing-wasm instalado', () => {
  const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
  assert.equal(
    sha('public/vendor/zxing/zxing_reader.wasm'),
    sha('node_modules/zxing-wasm/dist/reader/zxing_reader.wasm'),
    'public/vendor/zxing/zxing_reader.wasm está desactualizado: vuelve a copiarlo desde node_modules',
  );
});
