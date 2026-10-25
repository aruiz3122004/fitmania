import { test, expect, type Page } from '@playwright/test'

// Recorrido completo del modo sandbox contra los emuladores de Firebase
// (npm run test:e2e:sandbox). Nunca toca un proyecto real.
const PROJECT = 'demo-fitmania-sandbox'

/** Documentos de una colección leídos del emulador saltando las reglas. */
async function emulatorDocs(collection: string): Promise<any[]> {
  const res = await fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/${collection}?pageSize=300`, {
    headers: { Authorization: 'Bearer owner' },
  })
  return ((await res.json()).documents as any[]) || []
}

/** La barra del sandbox, abierta (fuera del inicio empieza cerrada para no tapar). */
async function openBar(page: Page) {
  const bar = page.getByRole('region', { name: 'Modo sandbox' })
  await expect(bar).toBeVisible()
  const toggle = bar.getByRole('button', { name: /SANDBOX/ }).first()
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
  return bar
}

async function enterSandbox(page: Page) {
  await page.goto('/sandbox')
  await page.getByRole('button', { name: 'ENTRAR AL SANDBOX' }).click()
  await page.waitForURL((url) => url.pathname === '/', { timeout: 60_000 })
  return openBar(page)
}

test.describe.configure({ mode: 'serial' })

test('entrar crea una cuenta temporal con los datos de ejemplo', async ({ page }) => {
  const bar = await enterSandbox(page)
  await expect(bar).toContainText(/Explorador [0-9A-Z]{4}/)
  await expect(bar.getByLabel('Tiempo restante')).toHaveText(/^1:5\d:\d\d$|^2:00:00$/)

  // Datos de ejemplo sembrados: 14 socios, 3 planes, 12 publicaciones (2 páginas en el foro).
  expect((await emulatorDocs('planes')).length).toBe(3)
  await page.goto('/foro')
  await expect(page.getByRole('navigation', { name: 'Páginas del foro' })).toBeVisible()
})

test('comprar un plan con la pasarela simulada lo activa y manda el recibo al buzón', async ({ page }) => {
  await enterSandbox(page)
  await page.goto('/pago?planId=estandar')
  await page.getByRole('button', { name: /PASARELA SIMULADA/ }).click()
  await page.waitForURL(/\/pago\/sandbox\?ref=fm_/)
  await expect(page.getByText('Pagar a FITMANIA')).toBeVisible()
  await page.getByRole('button', { name: /^Pagar \$/ }).click()

  await page.waitForURL(/\/pago\/resultado\?ref=fm_/)
  await expect(page.getByText('¡PAGO EXITOSO!')).toBeVisible({ timeout: 20_000 })

  const bar = await openBar(page)
  await expect(bar.getByRole('button', { name: /Buzón simulado/ })).toContainText('1 correo')
  await bar.getByRole('button', { name: /Buzón simulado/ }).click()
  const mailbox = page.getByRole('dialog', { name: 'Buzón del sandbox' })
  await expect(mailbox.getByRole('listitem')).toHaveCount(1)
})

test('abre el panel de administración y el de recepción sin llave', async ({ page }) => {
  const bar = await enterSandbox(page)
  await bar.getByRole('button', { name: 'Admin', exact: true }).click()
  await page.waitForURL(/\/fitministration/, { timeout: 30_000 })
  await expect(page.getByText('OPERACIONES')).toBeVisible({ timeout: 20_000 })

  await (await openBar(page)).getByRole('button', { name: 'Recepción', exact: true }).click()
  await page.waitForURL(/\/fitception/, { timeout: 30_000 })
  await expect(page.getByText('AUTORIZAR ACCESO')).toBeVisible({ timeout: 20_000 })
})

test('salir borra la cuenta temporal y todo lo que hizo', async ({ page }) => {
  const bar = await enterSandbox(page)
  const sessionsBefore = (await emulatorDocs('sandbox_sessions')).length
  expect(sessionsBefore).toBeGreaterThan(0)

  page.once('dialog', (d) => d.accept())
  await bar.getByRole('button', { name: 'Salir y borrar mis datos' }).click()
  await page.waitForURL(/\/sandbox\?salida=1/, { timeout: 30_000 })
  await expect(page.getByText(/borramos tu cuenta temporal/)).toBeVisible()
  expect((await emulatorDocs('sandbox_sessions')).length).toBe(sessionsBefore - 1)
})
