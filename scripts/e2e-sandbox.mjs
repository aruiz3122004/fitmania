// npm run test:e2e:sandbox — compila el sitio en modo sandbox (en .next-sandbox, sin
// tocar el build normal) y corre sus pruebas E2E contra los emuladores de Firebase.
//   --skip-build   reutiliza el build anterior
import { spawnSync } from 'node:child_process'
import { SANDBOX_E2E_ENV } from './sandbox-e2e-env.mjs'

const env = { ...process.env, ...SANDBOX_E2E_ENV }
const run = (cmd) => {
  const r = spawnSync(cmd, { stdio: 'inherit', shell: true, env })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

if (!process.argv.includes('--skip-build')) run('npx next build')
run('npx playwright test -c playwright.sandbox.config.ts')
