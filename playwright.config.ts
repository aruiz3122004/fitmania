import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas E2E de navegador (npm run test:e2e). Necesitan un build previo (`npm run build`).
 *
 * En local se puede usar el Edge o Chrome instalado sin descargar navegadores:
 *   PW_CHANNEL=msedge npm run test:e2e
 * En CI se instala Chromium con `npx playwright install --with-deps chromium`.
 *
 * Solo cubren flujos que no dependen de datos reales; los de login y pago van contra
 * staging cuando exista (docs/staging-y-respaldos.md).
 */
const PORT = Number(process.env.E2E_PORT || 3200)
const channel = process.env.PW_CHANNEL || undefined

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], channel } },
    { name: 'movil', use: { ...devices['Pixel 7'], channel } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/preguntas-frecuentes`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
