// npm run sandbox:local — abre el modo sandbox en tu computador, sin crear nada en la
// nube: emuladores de Firebase (Auth + Firestore) y `next dev` en http://localhost:3400/sandbox.
// Requiere Java 21 (el emulador de Firestore). Ctrl+C cierra ambos.
import { spawn } from 'node:child_process'
import { SANDBOX_E2E_ENV } from './sandbox-e2e-env.mjs'

const env = { ...process.env, ...SANDBOX_E2E_ENV, NEXT_DIST_DIR: '.next-sandbox-dev' }
const children = [
  spawn('npx firebase emulators:start --only auth,firestore --project demo-fitmania-sandbox', { stdio: 'inherit', shell: true, env }),
  spawn('npx next dev -p 3400', { stdio: 'inherit', shell: true, env }),
]
console.log('\n  Sandbox local: http://localhost:3400/sandbox (espera a que arranquen los emuladores)\n')

const stop = () => {
  for (const child of children) child.kill('SIGINT')
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
