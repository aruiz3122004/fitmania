// Prueba de carga de la hora pico (F4-01) con k6 — https://k6.io
//
// EJECUTAR SOLO CONTRA STAGING (genera lecturas reales en Firestore):
//   k6 run -e BASE_URL=https://staging.tudominio.com tools/load-test.js
//
// Para incluir el escaneo de recepción (escribe ingresos de prueba), exportar la
// cookie de una sesión de recepción de STAGING y una lista de UIDs de socios de prueba:
//   k6 run -e BASE_URL=... -e RECEPTION_COOKIE='fitmania_reception_session=...' \
//          -e TEST_UIDS='uid1,uid2,uid3' tools/load-test.js
//
// Escenario (estimación de hora pico ≈ 18:00): 50 socios navegando, 30 ingresos en
// 15 minutos y consultas del panel. Criterio de salida: p95 < 800 ms y < 1 % de errores.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const RECEPTION_COOKIE = __ENV.RECEPTION_COOKIE || '';
const TEST_UIDS = (__ENV.TEST_UIDS || '').split(',').filter(Boolean);

export const options = {
  scenarios: {
    socios_navegando: {
      executor: 'constant-vus',
      vus: 50,
      duration: '15m',
      exec: 'browse',
    },
    ingresos_recepcion: {
      executor: 'constant-arrival-rate',
      rate: 2, // 2 ingresos por minuto ≈ 30 en 15 minutos
      timeUnit: '1m',
      duration: '15m',
      preAllocatedVUs: 2,
      exec: 'checkIn',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{page:home}': ['p(95)<1200'],
  },
};

export function browse() {
  const pages = [
    ['/', 'home'],
    ['/planes', 'planes'],
    ['/tienda', 'tienda'],
    ['/foro', 'foro'],
    ['/api/public/news', 'news'],
  ];
  const [path, tag] = pages[Math.floor(Math.random() * pages.length)];
  const res = http.get(`${BASE}${path}`, { tags: { page: tag } });
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(3 + Math.random() * 7); // tiempo de lectura de una persona
}

export function checkIn() {
  if (!RECEPTION_COOKIE || TEST_UIDS.length === 0) {
    // Sin credenciales de staging solo se mide la salud del sistema.
    const res = http.get(`${BASE}/api/health`, { tags: { page: 'health' } });
    check(res, { 'health 200': (r) => r.status === 200 });
    return;
  }
  const uid = TEST_UIDS[Math.floor(Math.random() * TEST_UIDS.length)];
  const headers = { 'Content-Type': 'application/json', Cookie: RECEPTION_COOKIE };
  const scan = http.post(`${BASE}/api/recepcion/scan`, JSON.stringify({ code: uid, manual: true }), { headers, tags: { page: 'scan' } });
  check(scan, { 'scan 200': (r) => r.status === 200 });
  const entry = http.post(`${BASE}/api/recepcion/entry-log`, JSON.stringify({ userId: uid }), { headers, tags: { page: 'entry' } });
  // 409 = duplicado dentro de la ventana de 3 h: es el comportamiento esperado.
  check(entry, { 'ingreso 200/409': (r) => r.status === 200 || r.status === 409 });
}
