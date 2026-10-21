// Genera el par de claves Ed25519 del pase de acceso (F2-05).
// Uso: node tools/generate-qr-keys.mjs
// Copia las dos líneas en las variables de entorno de Vercel (y .env.local).
import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const publicDer = publicKey.export({ type: 'spki', format: 'der' });

console.log(`QR_SIGNING_PRIVATE_KEY=${Buffer.from(privatePem).toString('base64')}`);
console.log(`NEXT_PUBLIC_QR_PUBLIC_KEY=${Buffer.from(publicDer).toString('base64')}`);
console.log('\n# Opcional, cuando todos los socios tengan la app actualizada:');
console.log('# QR_REQUIRE_SIGNED=true');
