import { defineConfig, devices } from '@playwright/test'
import { SANDBOX_E2E_ENV } from './scripts/sandbox-e2e-env.mjs'

/**
 * E2E del modo sandbox contra los emuladores de Firebase (Auth + Firestore).
 * Se corre con `npm run test:e2e:sandbox`, que compila antes en `.next-sandbox`.
 */
const PORT = 3400
const channel = process.env.PW_CHANNEL || undefined

export default defineConfig({
  testDir: 'tests/e2e-sandbox',
  timeout: 90_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-sandbox' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    ...devices['Desktop Chrome'],
    channel,
  },
  webServer: [
    {
      command: 'npx firebase emulators:start --only auth,firestore --project demo-fitmania-sandbox',
      url: 'http://127.0.0.1:9099',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/sandbox`,
      env: SANDBOX_E2E_ENV,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
