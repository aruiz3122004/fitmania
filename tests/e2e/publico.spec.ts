import { test, expect } from '@playwright/test'

// Páginas públicas que no dependen de datos de Firestore (corren igual en CI con
// variables de ejemplo).

test.describe('Preguntas frecuentes', () => {
  test('busca sin importar tildes y abre la respuesta', async ({ page }) => {
    await page.goto('/preguntas-frecuentes')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/preguntas/i)

    await page.getByLabel('Buscar en las preguntas frecuentes').fill('contrasena')
    const pregunta = page.getByText('Olvidé mi contraseña, ¿qué hago?')
    await expect(pregunta).toBeVisible()
    // Con una búsqueda activa las respuestas se muestran abiertas.
    await expect(page.getByText(/Olvidé mi contraseña" y escribe tu correo/)).toBeVisible()
    await expect(page.getByText('¿Cómo puedo pagar?')).toHaveCount(0)
  })

  test('filtra por tema', async ({ page }) => {
    await page.goto('/preguntas-frecuentes')
    await page.getByRole('button', { name: 'Pagos y compras' }).click()
    await expect(page.getByRole('heading', { name: 'PAGOS Y COMPRAS' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'CUENTA Y SEGURIDAD' })).toHaveCount(0)
  })

  test('sin resultados ofrece escribir por PQRS', async ({ page }) => {
    await page.goto('/preguntas-frecuentes')
    await page.getByLabel('Buscar en las preguntas frecuentes').fill('zzzz sin coincidencias')
    await expect(page.getByText('SIN RESULTADOS')).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: 'PQRS' }).first()).toBeVisible()
  })

  test('no se desborda a lo ancho', async ({ page }) => {
    await page.goto('/preguntas-frecuentes')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})

test.describe('Avisos legales', () => {
  test('los términos advierten que el proyecto es ficticio y asistido por IA', async ({ page }) => {
    await page.goto('/legal/terminos')
    await expect(page.getByRole('note')).toContainText('proyecto de portafolio')
    await expect(page.getByRole('note')).toContainText('inteligencia artificial')
    await expect(page.getByText(/NIT 901\.091\.256-0/)).toBeVisible()
  })

  test('el pie de página enlaza las preguntas frecuentes', async ({ page }) => {
    await page.goto('/legal/privacidad')
    await page.locator('footer').getByRole('link', { name: 'Preguntas frecuentes' }).click()
    await expect(page).toHaveURL(/\/preguntas-frecuentes$/)
  })
})

test.describe('Seguridad', () => {
  test('los paneles ocultos responden 404 sin la llave de acceso', async ({ request }) => {
    for (const path of ['/fitministration', '/fitception']) {
      const res = await request.get(path, { maxRedirects: 0 })
      expect(res.status(), path).toBe(404)
    }
  })

  test('las páginas llevan CSP con nonce', async ({ request }) => {
    const res = await request.get('/preguntas-frecuentes')
    expect(res.headers()['content-security-policy']).toMatch(/script-src[^;]*'nonce-/)
  })

  test('las rutas retiradas ya no existen', async ({ request }) => {
    for (const path of ['/api/stripe/webhook', '/api/public/products', '/api/diag']) {
      const res = await request.post(path, { data: {} })
      expect([404, 405], path).toContain(res.status())
    }
  })
})
