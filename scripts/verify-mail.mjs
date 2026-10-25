import env from '@next/env'

const { loadEnvConfig } = env
loadEnvConfig(process.cwd())

const apiKey = process.env.RESEND_API_KEY
const mailFrom = process.env.MAIL_FROM || 'Fitmania <onboarding@resend.dev>'

console.log('RESEND_API_KEY :', apiKey ? `presente (len=${apiKey.length}, prefix=${apiKey.slice(0, 3)}...)` : '(FALTA)')
console.log('MAIL_FROM      :', mailFrom)
console.log('')

async function main() {
  if (!apiKey) {
    console.log('Falta RESEND_API_KEY. Créala en https://resend.com/api-keys y añádela a .env.local')
    process.exitCode = 1
    return
  }

  const args = process.argv.slice(2)

  // Modo envío de prueba: `node scripts/verify-mail.mjs --send [--to=correo]`
  // En modo test de Resend el destinatario debe ser el correo dueño de la cuenta.
  if (args.includes('--send')) {
    const toArg = args.find((a) => a.startsWith('--to='))?.slice(5)
    const to = toArg || process.env.ADMIN_COPY_EMAIL || process.env.ADMIN_AUTHORIZED_EMAIL
    if (!to) {
      console.log('No hay destinatario. Usa --to=correo@dominio.com')
      process.exitCode = 1
      return
    }
    console.log(`Enviando correo de PRUEBA a ${to} ...`)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: mailFrom,
        to: [to],
        subject: '✅ Prueba de correo - Fitmania',
        html: '<p>Si ves este correo en tu bandeja, el envío por <strong>Resend</strong> ya funciona correctamente.</p><p>— Fitmania</p>',
      }),
    })
    const body = await res.text().catch(() => '')
    console.log(`HTTP ${res.status}: ${body.slice(0, 300)}`)
    if (!res.ok) process.exitCode = 1
    return
  }

  // GET /domains es de solo lectura: valida la API key y muestra los dominios
  // verificados (necesarios para enviar a terceros). No envía ningún correo.
  const res = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.log(`API key inválida o error (HTTP ${res.status}): ${body.slice(0, 300)}`)
    process.exitCode = 1
    return
  }

  const data = await res.json()
  const domains = data?.data || []

  if (domains.length === 0) {
    console.log('La API key es válida, pero NO hay dominios registrados en Resend.')
    console.log('Sin dominio verificado solo puedes usar: MAIL_FROM="Fitmania <onboarding@resend.dev>"')
    console.log('y solo hacia el correo dueño de la cuenta.')
  } else {
    console.log('Dominios en Resend:')
    for (const d of domains) {
      console.log(`   - ${d.name}  [status=${d.status}]`)
    }
    const verified = domains.filter((d) => d.status === 'verified').map((d) => d.name)
    if (verified.length === 0) {
      console.log('\nNinguno está verificado todavía: envía a clientes fallará hasta verificarlo (DNS).')
    } else {
      console.log(`\nListo para enviar. Asegúrate de que MAIL_FROM use uno de: ${verified.join(', ')}`)
    }
  }
}

await main()
