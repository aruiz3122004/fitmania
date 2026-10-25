/**
 * Datos de ejemplo del sandbox (ver lib/sandbox.ts).
 *
 * Función pura: devuelve las cuentas y los documentos a crear, con fechas relativas a
 * `now` para que el panel siempre muestre "las últimas semanas". El azar sale de una
 * semilla fija, así cada reinicio deja exactamente lo mismo. Sin imports del proyecto
 * para poder probarlo con `node --test`.
 */

export const SEED_VERSION = 1
const DOMAIN = 'sandbox.fitmania.test'
const TZ = 'America/Bogota'
const DAY = 86_400_000

export interface SeedAuthUser {
  uid: string
  email: string
  displayName: string
  claims: Record<string, boolean> | null
}

export interface SeedDoc {
  path: string
  data: Record<string, unknown>
}

export interface SandboxSeed {
  authUsers: SeedAuthUser[]
  docs: SeedDoc[]
}

/** Colecciones que el reinicio vacía por completo antes de sembrar. */
export const SANDBOX_COLLECTIONS = [
  'users', 'public_profiles', 'planes', 'products', 'news', 'posts', 'orders', 'payments',
  'payment_events', 'entry_logs', 'checkIns', 'daily_stats', 'monthly_stats', 'notifications',
  'pqrs', 'reportes', 'inventory_movements', 'inventory_counts', 'cash_closures', 'sales_periods',
  'email_events', 'audit_logs', 'consents', 'forum_rate', 'mfa_state', 'mfa_challenges',
  'sandbox_mail', 'history', 'system', 'logs',
] as const

// Generador determinista (mulberry32).
function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dateKey(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

function hourKey(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(d).padStart(2, '0')
}

/** Fecha a una hora local de Barranquilla (UTC-5, sin horario de verano). */
function atLocal(day: Date, hour: number, minute: number): Date {
  const [y, m, d] = dateKey(day).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hour + 5, minute))
}

const PLANS = [
  {
    id: 'estandar', name: 'Plan Estándar', price: 90_000, days: 30, icon: 'Coffee', duration: 'mes',
    description: 'Acceso ilimitado a la sala de pesas y cardio.',
    features: ['Acceso de lunes a domingo', 'Zona de pesas y cardio', 'Evaluación física inicial', 'App con pase QR'],
    featured: false, ribbon: 'CLÁSICO', ribbonFeatured: false,
  },
  {
    id: 'dosenuno', name: 'Plan Dos en Uno', price: 150_000, days: 60, icon: 'Star', duration: '2 meses',
    description: 'Dos meses al precio de uno y medio, con clases grupales incluidas.',
    features: ['60 días de acceso', 'Clases grupales', 'Plan de entrenamiento personalizado', 'Marco dorado en la app'],
    featured: true, ribbon: 'MEJOR VALOR', ribbonFeatured: true,
  },
  {
    id: 'parejas', name: 'Plan Parejas', price: 160_000, days: 30, icon: 'Users', duration: 'mes',
    description: 'Entrena acompañado: dos personas, un solo plan.',
    features: ['Acceso para dos personas', 'Rutinas en pareja', 'Evaluación física para ambos', 'Marco Dúo en la app'],
    featured: false, ribbon: 'DÚO', ribbonFeatured: false,
  },
]

const img = (p: string) => encodeURI(p)

const PRODUCTS = [
  { id: 'proteina-whey', nombre: 'Proteína Whey 2 lb', categoria: 'suplementos', precio: 180_000, stock: 14, imagen_url: img('/Imagenes/suplementos/proteina.png'), badge: 'TOP', descripcion: 'Proteína de suero sabor vainilla, 28 porciones.' },
  { id: 'creatina', nombre: 'Creatina Monohidratada', categoria: 'suplementos', precio: 95_000, stock: 4, imagen_url: img('/Imagenes/suplementos/creatina_mono.png'), descripcion: '300 g, sin sabor. Ideal para fuerza y potencia.' },
  { id: 'aminoacidos', nombre: 'Aminoácidos BCAA', categoria: 'suplementos', precio: 85_000, stock: 20, imagen_url: img('/Imagenes/suplementos/aminoacidos.png'), descripcion: 'Recuperación muscular, sabor limón.' },
  { id: 'magnesio', nombre: 'Citrato de Magnesio', categoria: 'suplementos', precio: 45_000, stock: 0, imagen_url: img('/Imagenes/suplementos/citrato_magnesio.png'), descripcion: '120 cápsulas. Agotado para mostrar el estado sin stock.' },
  { id: 'maranones', nombre: 'Marañones 200 g', categoria: 'snacks', precio: 12_000, stock: 40, imagen_url: img('/Imagenes/Snacks/Marañones.jpeg'), descripcion: 'Snack natural alto en grasas buenas.' },
  { id: 'camisa', nombre: 'Camisa FITMANIA', categoria: 'ropa', precio: 55_000, stock: 18, imagen_url: img('/Imagenes/Ropa/Camisa.jpeg'), colores: ['Rojo', 'Negro'], tallas: ['S', 'M', 'L', 'XL'], descripcion: 'Camiseta dry-fit con el logo del gimnasio.' },
  { id: 'conjunto-mujer', nombre: 'Conjunto Deportivo Mujer', categoria: 'ropa', precio: 120_000, stock: 9, imagen_url: img('/Imagenes/Ropa/Conjunto Mujer.jpeg'), colores: ['Negro', 'Vino'], tallas: ['S', 'M', 'L'], descripcion: 'Top y licra de alta compresión.' },
  { id: 'pantaloneta', nombre: 'Pantaloneta de Entreno', categoria: 'ropa', precio: 48_000, stock: 15, imagen_url: img('/Imagenes/Ropa/Pantaloneta.jpeg'), colores: ['Negro', 'Azul'], tallas: ['M', 'L', 'XL'], descripcion: 'Tela liviana con bolsillo.' },
  { id: 'medias', nombre: 'Medias Deportivas x3', categoria: 'ropa', precio: 18_000, stock: 30, imagen_url: img('/Imagenes/Ropa/Medias.jpeg'), colores: ['Blanco'], tallas: ['Única'], descripcion: 'Paquete de tres pares.' },
]

// Socios ficticios: [id, usuario, avatar, plan, días restantes (negativo = vencido), congelado]
const MEMBERS: [string, string, string, string | null, number, boolean][] = [
  ['01', 'valeria.gym', 'fitwoman', 'dosenuno', 41, false],
  ['02', 'camilo_fuerza', 'fitman', 'estandar', 18, false],
  ['03', 'sofi.runner', 'fitinha', 'parejas', 22, false],
  ['04', 'andres.power', 'fito', 'parejas', 22, false],
  ['05', 'mafe_fit', 'fitwoman', 'estandar', 3, false],
  ['06', 'juanda.lifts', 'fitman', 'estandar', 2, false],
  ['07', 'nata.squat', 'fitinha', 'dosenuno', 55, false],
  ['08', 'el.profe.dairo', 'fatu', 'estandar', 12, true],
  ['09', 'luisa.cardio', 'fitwoman', 'estandar', -6, false],
  ['10', 'santi.bulk', 'fitdog', 'estandar', -20, false],
  ['11', 'karen.core', 'fitinha', 'estandar', 26, false],
  ['12', 'mateo.box', 'fito', 'dosenuno', 9, false],
  ['13', 'dani.nuevo', 'fitman', null, 0, false],
  ['14', 'laura.yoga', 'fitwoman', 'estandar', 15, false],
]

const AVATAR_URL: Record<string, string> = {
  fitman: '/Imagenes/Avatares/FitmanNEW.png',
  fitwoman: '/Imagenes/Avatares/FitwomanNEW.png',
  fitdog: '/Imagenes/Avatares/FitdogNEW.png',
  fitinha: '/Imagenes/Avatares/FitinhaNEW.png',
  fito: '/Imagenes/Avatares/FitoNEW.png',
  fatu: '/Imagenes/Avatares/FatuNEW.png',
}

const POSTS = [
  ['01', '¡Nuevo récord en sentadilla! 100 kg limpios. Gracias a los coaches por la paciencia 💪', ['02', '07', '11']],
  ['02', '¿Alguien para entrenar pierna mañana a las 6 AM? Busco compañero de spot.', ['06']],
  ['03', 'Con el Plan Parejas por fin convencí a Andrés de venir conmigo 😂🤝', ['04', '01', '14']],
  ['05', 'Tip: tomen agua antes, durante y después. El calor de Barranquilla no perdona ☀️', ['09', '11', '12', '03']],
  ['07', 'Clase grupal de los sábados = lo mejor de la semana. ¿Quién se apunta?', ['01', '14']],
  ['12', 'Semana 3 del programa de fuerza. Ya noto la diferencia en press banca.', ['02']],
  ['11', 'Recomienden snacks post-entreno que no sean barras de proteína 🙏', ['05']],
  ['14', 'El estiramiento después del entreno no es opcional, lo aprendí por las malas 😅', ['03', '07']],
  ['02', 'Hoy tocó espalda y bíceps. Mañana descanso activo.', []],
  ['06', '¿A qué hora está más vacío el gym? Prefiero entrenar tranquilo.', ['08']],
  ['04', 'Primera vez que hago peso muerto con buena técnica. ¡Gracias coach Randy!', ['01', '03']],
  ['01', 'Recuerden que la constancia gana a la intensidad. Nos vemos mañana 🔥', ['02', '04', '05', '07', '12']],
] as const

const COMMENTS: Record<number, [string, string][]> = {
  0: [['02', '¡Bestia! Ese esfuerzo se nota.'], ['07', 'Vamos por los 110 🔥']],
  1: [['06', 'Yo me apunto, nos vemos en la zona de racks.']],
  3: [['09', 'Totalmente, yo casi me desmayo la semana pasada 😅']],
  6: [['05', 'Marañones de la tienda del gym, son buenísimos.'], ['12', 'Banano con mantequilla de maní.']],
  9: [['08', 'Entre 10 AM y 3 PM está tranquilo. Mira el mapa de concurrencia en recepción.']],
}

export function buildSandboxSeed(now: Date = new Date()): SandboxSeed {
  const rand = rng(20270101)
  const pick = <T,>(list: readonly T[]) => list[Math.floor(rand() * list.length)]
  const docs: SeedDoc[] = []
  const authUsers: SeedAuthUser[] = []
  const add = (path: string, data: Record<string, unknown>) => docs.push({ path, data })

  docs.push({ path: 'system/sandbox', data: { seedVersion: SEED_VERSION, seededAt: now, dirty: false } })

  // Catálogo.
  for (const plan of PLANS) {
    const { id, ...data } = plan
    add(`planes/${id}`, { ...data, createdAt: new Date(now.getTime() - 120 * DAY), updatedAt: now })
  }
  for (const product of PRODUCTS) {
    const { id, ...data } = product
    add(`products/${id}`, { lowStockThreshold: 5, colores: [], tallas: [], badge: '', ...data })
  }

  add('news/apertura-sabados', {
    titulo: '¡Clases grupales los sábados!', descripcion: 'Funcional, rumba y boxeo de 8:00 a 11:00 AM. Incluidas en el Plan Dos en Uno.',
    imagen_url: img('/Imagenes/Fitmania Gym.jpeg'), published: true, publishAt: null, createdAt: new Date(now.getTime() - 3 * DAY), createdBy: 'admin@' + DOMAIN,
  })
  add('news/nueva-tienda', {
    titulo: 'Nueva tienda en recepción', descripcion: 'Suplementos, snacks y ropa FITMANIA. Compra en la app y recoge en el gimnasio.',
    imagen_url: img('/Imagenes/Tienda Fitmania.jpeg'), published: true, publishAt: null, createdAt: new Date(now.getTime() - 9 * DAY), createdBy: 'admin@' + DOMAIN,
  })
  add('news/borrador-reto', {
    titulo: 'Reto 30 días (borrador)', descripcion: 'Noticia sin publicar: solo se ve en el panel de administración.',
    imagen_url: null, published: false, publishAt: null, createdAt: new Date(now.getTime() - 1 * DAY), createdBy: 'admin@' + DOMAIN,
  })

  // Socios.
  const members = MEMBERS.map(([n, username, avatar, planId, daysLeft, frozen]) => {
    const uid = `sbx-socio-${n}`
    const email = `${username.replace(/[^a-z0-9]/g, '')}@${DOMAIN}`
    const planDef = PLANS.find((p) => p.id === planId)
    const expira = new Date(now.getTime() + daysLeft * DAY)
    const plan = planDef
      ? {
          nombre: planDef.name, planId: planDef.id, precio: planDef.price, dias_total: planDef.days,
          inicio: new Date(expira.getTime() - planDef.days * DAY), expira,
          frozen: frozen ? { since: new Date(now.getTime() - 4 * DAY), reason: 'Viaje de trabajo', remainingMs: daysLeft * DAY, by: 'admin@' + DOMAIN } : null,
        }
      : null
    const photoURL = AVATAR_URL[avatar]
    authUsers.push({ uid, email, displayName: username, claims: null })
    add(`users/${uid}`, { uid, username, email, avatar, photoURL, plan, createdAt: new Date(now.getTime() - (60 + Number(n) * 3) * DAY), sandboxSeed: true })
    add(`public_profiles/${uid}`, { username, photoURL, updatedAt: now })
    return { n, uid, username, email, plan, photoURL }
  })
  const byN = (n: string) => members.find((m) => m.n === n)!

  // Recepcionista de ejemplo (para ver roles en el panel de usuarios).
  authUsers.push({ uid: 'sbx-recepcion', email: `recepcion@${DOMAIN}`, displayName: 'recepcion.demo', claims: { receptionist: true } })
  add('users/sbx-recepcion', { uid: 'sbx-recepcion', username: 'recepcion.demo', email: `recepcion@${DOMAIN}`, avatar: 'fatu', photoURL: AVATAR_URL.fatu, plan: null, createdAt: new Date(now.getTime() - 200 * DAY), sandboxSeed: true })

  // Ingresos de las últimas 3 semanas (horas pico de mañana y tarde).
  const HOURS = [5, 6, 6, 7, 7, 8, 9, 12, 17, 17, 18, 18, 18, 19, 19, 20]
  const stats: Record<string, { visits: number; uniqueMembers: number; withPlan: number; withoutPlan: number; byHour: Record<string, number> }> = {}
  const lastEntry: Record<string, Date> = {}
  let entryCount = 0
  for (let d = 21; d >= 1; d--) {
    const day = new Date(now.getTime() - d * DAY)
    const isSunday = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(day) === 'Sun'
    const visitors = members.filter(() => rand() < (isSunday ? 0.25 : 0.55))
    for (const m of visitors) {
      const at = atLocal(day, isSunday ? 8 + Math.floor(rand() * 6) : pick(HOURS), Math.floor(rand() * 60))
      const expira = m.plan?.expira as Date | undefined
      const hasPlanActivo = !!expira && expira.getTime() > at.getTime() && !m.plan?.frozen
      const date = dateKey(at)
      const id = `sbx-entry-${++entryCount}`
      const authorizedBy = { authorizedBy: `recepcion@${DOMAIN}`, authorizedByUid: 'sbx-recepcion' }
      add(`entry_logs/${id}`, {
        userId: m.uid, userName: m.username, userEmail: m.email, hasPlanActivo,
        planNombre: m.plan?.nombre ?? null, planExpira: expira ?? null, timestamp: at, date, source: 'qr', ...authorizedBy,
      })
      add(`checkIns/${id}`, { userId: m.uid, userName: m.username, timestamp: at, hasPlanActivo, ...authorizedBy })
      const s = (stats[date] ??= { visits: 0, uniqueMembers: 0, withPlan: 0, withoutPlan: 0, byHour: {} })
      s.visits++
      s.uniqueMembers++
      if (hasPlanActivo) s.withPlan++
      else s.withoutPlan++
      const h = hourKey(at)
      s.byHour[h] = (s.byHour[h] || 0) + 1
      if (!lastEntry[m.uid] || lastEntry[m.uid] < at) lastEntry[m.uid] = at
    }
  }
  for (const [date, s] of Object.entries(stats)) add(`daily_stats/${date}`, { date, ...s, updatedAt: now })
  for (const doc of docs) {
    const uid = doc.path.startsWith('users/') ? doc.path.slice(6) : null
    if (uid && lastEntry[uid]) doc.data.lastEntryAt = lastEntry[uid]
  }

  // Ventas: planes y tienda de las últimas semanas, con su pago aprobado.
  const sales: { n: string; daysAgo: number; plan?: string; items?: [string, number][] }[] = [
    { n: '01', daysAgo: 19, plan: 'dosenuno' }, { n: '07', daysAgo: 5, plan: 'dosenuno' },
    { n: '03', daysAgo: 8, plan: 'parejas' }, { n: '02', daysAgo: 12, plan: 'estandar' },
    { n: '11', daysAgo: 4, plan: 'estandar' }, { n: '14', daysAgo: 15, plan: 'estandar' },
    { n: '12', daysAgo: 51, plan: 'dosenuno' }, { n: '05', daysAgo: 27, plan: 'estandar' },
    { n: '01', daysAgo: 2, items: [['proteina-whey', 1], ['maranones', 2]] },
    { n: '06', daysAgo: 6, items: [['creatina', 1]] },
    { n: '07', daysAgo: 10, items: [['conjunto-mujer', 1]] },
    { n: '02', daysAgo: 1, items: [['camisa', 2], ['medias', 1]] },
    { n: '11', daysAgo: 13, items: [['aminoacidos', 1]] },
    { n: '04', daysAgo: 16, items: [['pantaloneta', 1], ['maranones', 3]] },
  ]
  sales.forEach((sale, i) => {
    const m = byN(sale.n)
    const fecha = new Date(now.getTime() - sale.daysAgo * DAY - Math.floor(rand() * 8) * 3_600_000)
    const ref = `sbx_order_${String(i + 1).padStart(2, '0')}`
    const plan = sale.plan ? PLANS.find((p) => p.id === sale.plan)! : null
    const items = (sale.items || []).map(([id, cantidad]) => {
      const p = PRODUCTS.find((x) => x.id === id)!
      return { id, nombre: p.nombre, precio: p.precio, cantidad }
    })
    const total = plan ? plan.price : items.reduce((acc, it) => acc + it.precio * it.cantidad, 0)
    const concept = plan ? plan.name : items.map((it) => `${it.nombre} x${it.cantidad}`).join(', ')
    const type = plan ? 'plan' : 'products'
    const banco = pick(['Tarjeta de crédito (visa)', 'PSE', 'Tarjeta débito (master)', 'Efecty'])
    add(`orders/${ref}`, {
      uid: m.uid, customerName: m.username, customerEmail: m.email, type, planId: plan?.id ?? null, concepto: concept,
      items, total, banco, gateway: 'sandbox', paymentId: 9_000_000 + i, fecha, status: 'paid',
    })
    add(`payments/${ref}`, {
      gateway: 'sandbox', status: 'approved', uid: m.uid, customerEmail: m.email, customerName: m.username,
      type, planId: plan?.id ?? null, concept, amount: total, dias: plan?.days ?? null, items,
      method: banco, mpPaymentId: 9_000_000 + i, createdAt: fecha, approvedAt: fecha, updatedAt: fecha,
    })
  })

  // Foro: 12 publicaciones (dos páginas) con likes y comentarios.
  POSTS.forEach(([n, contenido, likes], i) => {
    const m = byN(n)
    const created = new Date(now.getTime() - (i * 19 + 2) * 3_600_000)
    const id = `sbx-post-${String(i + 1).padStart(2, '0')}`
    const tier = m.plan && (m.plan.expira as Date) > now && !m.plan.frozen ? m.plan.planId : null
    add(`posts/${id}`, {
      autor_id: m.uid, autor_username: m.username, autor_avatar: m.photoURL, autor_is_premium: !!tier, autor_plan_tier: tier,
      contenido, imagen_url: null, imagen_public_id: null, tipo_recurso: 'image',
      likes: likes.map((l) => byN(l).uid), comentarios: [], created_at: created,
    })
    ;(COMMENTS[i] || []).forEach(([cn, text], j) => {
      const c = byN(cn)
      add(`posts/${id}/comments/sbx-c-${i}-${j}`, {
        autor_id: c.uid, autor_username: c.username, autor_avatar: c.photoURL, autor_is_premium: false, autor_plan_tier: null,
        contenido: text, created_at: new Date(created.getTime() + (j + 1) * 1_800_000),
      })
    })
  })
  add('reportes/sbx-post-10_sbx-socio-09', {
    reportante: 'luisa.cardio', reportante_id: 'sbx-socio-09', publicacion_id: 'sbx-post-10', autor_publicacion: 'juanda.lifts',
    motivo: 'spam', fecha_publicacion: new Date(now.getTime() - 173 * 3_600_000), fecha_reporte: new Date(now.getTime() - 20 * 3_600_000), estado: 'pendiente',
  })

  // PQRS y avisos del panel.
  const pqrs: [string, string, string, number][] = [
    ['09', 'peticion', 'Quisiera saber si puedo congelar mi plan dos semanas por un viaje.', 1],
    ['06', 'sugerencia', 'Sería genial tener más mancuernas de 12 kg en la zona libre.', 3],
    ['10', 'reclamo', 'Mi plan venció y no me llegó el recordatorio por correo.', 6],
  ]
  pqrs.forEach(([n, tipo, mensaje, daysAgo], i) => {
    const m = byN(n)
    const at = new Date(now.getTime() - daysAgo * DAY)
    add(`pqrs/sbx-pqrs-${i + 1}`, {
      tipo, mensaje, userId: m.uid, userName: m.username, userEmail: m.email,
      fecha: new Intl.DateTimeFormat('es-CO', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(at),
      hora: new Intl.DateTimeFormat('es-CO', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(at),
      createdAt: at, status: 'pending',
    })
  })
  const notes: [string, string, number][] = [
    ['low_stock', '¡Alerta! El producto Creatina Monohidratada tiene stock crítico: 4 unidades.', 6],
    ['purchase', 'valeria.gym pagó $ 192.000 (Proteína Whey 2 lb x1, Marañones 200 g x2) con PSE.', 2],
    ['pqrs', 'Nueva PQRS (peticion) de luisa.cardio.', 1],
    ['purchase', 'camilo_fuerza pagó $ 128.000 (Camisa FITMANIA x2, Medias Deportivas x3 x1) con Tarjeta de crédito (visa).', 1],
  ]
  notes.forEach(([tipo, mensaje, daysAgo], i) => {
    add(`notifications/sbx-note-${i + 1}`, { tipo, mensaje, leido: false, fecha: new Date(now.getTime() - daysAgo * DAY) })
  })

  return { authUsers, docs }
}
