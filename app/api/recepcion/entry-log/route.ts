import { NextRequest, NextResponse, after } from 'next/server';
import { sendPushToUser } from '@/lib/push-server';
import type { Query } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { verifyReceptionRequest } from '@/lib/auth-helpers';
import { getDateKeyInAppTz, formatInAppTz, getHourKeyInAppTz } from '@/lib/datetime';
import { DAILY_STATS, recordEntryInDailyStats } from '@/lib/attendance';
import { maskEmail } from '@/lib/reception-members';
import ExcelJS from 'exceljs';

// T-19: límites de exportación para no agotar memoria/tiempo en la función serverless.
const MAX_EXPORT_DAYS = 92;    // ~3 meses por exportación
const MAX_EXPORT_ROWS = 20000; // tope de filas por exportación

// Ventana anti-duplicados: un mismo socio no se registra dos veces dentro de este lapso
// (doble escaneo, reintento del botón). Evita inflar el conteo de asistencia.
const DUPLICATE_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 horas

/** Convierte un Timestamp de Firestore, Date o string ISO a Date (o null). */
function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─── POST: Registrar una nueva entrada ───
// F2-03 (parcial) / A08: el cliente SOLO envía el `userId` escaneado. Nombre, correo y
// estado del plan los deriva el servidor desde `users/{uid}` (antes los enviaba el
// navegador de recepción y se podían alterar). Quien autoriza queda registrado con
// su uid/correo real, y el registro es atómico con su copia en `checkIns`.
export async function POST(request: NextRequest) {
  try {
    // Verificar sesión de recepción: cookie HttpOnly + claim (T-10, auditoría M-2)
    const decoded = await verifyReceptionRequest(request);
    if (!decoded) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    if (!userId || userId.includes('/') || userId.length > 128) {
      return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 });
    }

    // F2-06 / F2-07: ingresos diferidos (sin conexión o cargados desde la planilla en
    // papel) traen su hora real y un `clientId` único que hace idempotente el reintento.
    const deferredSource = body?.source === 'offline' || body?.source === 'manual' ? body.source : null;
    let now = new Date();
    let clientId: string | null = null;
    if (deferredSource) {
      const occurred = new Date(body?.occurredAt);
      const maxBackdate = 7 * 24 * 60 * 60 * 1000;
      if (Number.isNaN(occurred.getTime()) || occurred.getTime() > now.getTime() + 5 * 60 * 1000 || now.getTime() - occurred.getTime() > maxBackdate) {
        return NextResponse.json({ error: 'Fecha del ingreso diferido inválida (máximo 7 días atrás).' }, { status: 400 });
      }
      now = occurred;
      clientId = typeof body?.clientId === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(body.clientId) ? body.clientId : null;
      if (!clientId) return NextResponse.json({ error: 'clientId inválido.' }, { status: 400 });
    }
    // Formato YYYY-MM-DD en la zona horaria de la app (T-20: sin offsets manuales)
    const dateStr = getDateKeyInAppTz(now);

    const firestore = getAdminFirestore();
    const userRef = firestore.collection('users').doc(userId);
    const entryRef = clientId
      ? firestore.collection('entry_logs').doc(`${deferredSource}_${clientId}`)
      : firestore.collection('entry_logs').doc();
    const checkInRef = firestore.collection('checkIns').doc(entryRef.id);
    const sameDayQuery = firestore
      .collection('entry_logs')
      .where('userId', '==', userId)
      .where('date', '==', dateStr);

    const result = await firestore.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) return { status: 'not_found' as const };
      // Reintento de sincronización de un ingreso diferido ya registrado.
      if (clientId && (await tx.get(entryRef)).exists) {
        return { status: 'duplicate' as const, lastEntry: now };
      }

      // Anti-duplicados dentro de la transacción (dos escaneos simultáneos no pasan ambos).
      const sameDay = await tx.get(sameDayQuery);
      const lastEntry = sameDay.docs
        .map((d) => toDate(d.data().timestamp))
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      // abs(): un ingreso diferido puede ser anterior al último registrado.
      if (lastEntry && Math.abs(now.getTime() - lastEntry.getTime()) < DUPLICATE_WINDOW_MS) {
        return { status: 'duplicate' as const, lastEntry };
      }

      const user = userSnap.data() || {};
      const expira = toDate(user.plan?.expira);
      const hasPlanActivo = !!expira && expira.getTime() > now.getTime();
      const userName = String(user.username || user.email || 'Socio');
      const userEmail = String(user.email || '');

      const authorizedBy = {
        authorizedBy: decoded.email || 'Recepcionista',
        authorizedByUid: decoded.uid,
      };

      tx.set(entryRef, {
        userId,
        userName,
        userEmail,
        hasPlanActivo,
        planNombre: user.plan?.nombre || null,
        planExpira: expira,
        timestamp: now,
        date: dateStr,
        source: deferredSource || 'qr',
        ...authorizedBy,
      });
      // Copia para el historial individual del panel de recepción (antes la escribía el cliente).
      tx.set(checkInRef, {
        userId,
        userName,
        timestamp: now,
        hasPlanActivo,
        ...authorizedBy,
      });

      // F3-26: último ingreso del socio (lista de socios en riesgo de abandono).
      const previousLast = toDate(user.lastEntryAt);
      if (!previousLast || previousLast.getTime() < now.getTime()) {
        tx.update(userRef, { lastEntryAt: now });
      }

      // F2-03: agregados del día en la misma transacción (mapa de concurrencia, medias, diario).
      recordEntryInDailyStats(firestore, tx, {
        date: dateStr,
        hourKey: getHourKeyInAppTz(now),
        isFirstOfDay: sameDay.empty,
        hasPlanActivo,
      });

      return { status: 'created' as const, hasPlanActivo, planNombre: user.plan?.nombre || null, userName };
    });

    if (result.status === 'not_found') {
      return NextResponse.json({ error: 'Socio no encontrado.' }, { status: 404 });
    }
    if (result.status === 'duplicate') {
      return NextResponse.json(
        {
          error: `Este socio ya registró ingreso a las ${formatInAppTz(result.lastEntry, { hour: '2-digit', minute: '2-digit', hour12: false })}.`,
          duplicate: true,
        },
        { status: 409 }
      );
    }

    // F3-14: aviso al socio (también alerta antifraude si alguien usa su pase).
    if (!deferredSource) {
      const hora = formatInAppTz(now, { hour: '2-digit', minute: '2-digit', hour12: false });
      after(() =>
        sendPushToUser(userId, 'entries', {
          title: '✅ Ingreso registrado',
          body: result.hasPlanActivo
            ? `Bienvenido a FITMANIA. Ingreso registrado a las ${hora}.`
            : `Ingreso registrado a las ${hora}. Tu plan no está vigente: renuévalo en la app.`,
          url: '/perfil',
        })
      );
    }

    return NextResponse.json({
      success: true,
      entryId: entryRef.id,
      hasPlanActivo: result.hasPlanActivo,
      planNombre: result.planNombre,
      userName: result.userName,
    });
  } catch (error: any) {
    console.error('Error en POST /api/recepcion/entry-log:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

// ─── GET: Consultar entradas con paginación y exportación ───
export async function GET(request: NextRequest) {
  try {
    // Verificar sesión de recepción: cookie HttpOnly + email autorizado (T-10, auditoría M-2)
    const decoded = await verifyReceptionRequest(request);
    if (!decoded) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action'); // 'calendar' for getting days with entries
    const date = searchParams.get('date'); // YYYY-MM-DD
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.max(1, Math.min(200, parseInt(searchParams.get('pageSize') || '5')));
    const format = searchParams.get('format'); // 'json' | 'excel'
    const from = searchParams.get('from'); // YYYY-MM-DD (rango, T-19)
    const to = searchParams.get('to');     // YYYY-MM-DD (rango, T-19)
    const isExport = format === 'json' || format === 'excel';

    // T-19: la exportación NO debe cargar toda la colección en memoria.
    // Se exige un rango acotado: un día (`date`) o `from` + `to`.
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (isExport) {
      if (!date && !(from && to)) {
        return NextResponse.json(
          { error: 'La exportación requiere un rango de fechas: usa `date` (un día) o `from` + `to`.' },
          { status: 400 }
        );
      }
      if (from && to) {
        if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
          return NextResponse.json(
            { error: 'Rango de fechas inválido (formato YYYY-MM-DD y from <= to).' },
            { status: 400 }
          );
        }
        const rangeDays = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
        if (rangeDays > MAX_EXPORT_DAYS) {
          return NextResponse.json(
            { error: `El rango máximo de exportación es ${MAX_EXPORT_DAYS} días.` },
            { status: 400 }
          );
        }
      }
    }

    const firestore = getAdminFirestore();

    // ─── Obtener días con entradas (para el calendario) ───
    if (action === 'calendar') {
      const month = searchParams.get('month'); // YYYY-MM
      if (!month || !/^[0-9]{4}-[0-9]{2}$/.test(month)) {
        return NextResponse.json({ error: 'Parámetro `month` requerido (YYYY-MM).' }, { status: 400 });
      }
      const startDate = `${month}-01`;
      const endDate = `${month}-31`;

      // F2-19: se leen los agregados diarios (≤ 31 documentos) en lugar de todas las
      // entradas del mes (~3 000 lecturas).
      const statsSnap = await firestore
        .collection(DAILY_STATS)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get();
      let days = statsSnap.docs
        .filter((doc) => (Number(doc.data().visits) || 0) > 0)
        .map((doc) => doc.id);

      // Respaldo para meses anteriores a los agregados (sin `daily_stats`).
      if (statsSnap.empty) {
        const legacySnap = await firestore
          .collection('entry_logs')
          .where('date', '>=', startDate)
          .where('date', '<=', endDate)
          .select('date')
          .get();
        days = Array.from(new Set(legacySnap.docs.map((doc) => doc.data().date).filter(Boolean)));
      }

      return NextResponse.json({ days });
    }

    // ─── Construir query sin índice compuesto ───
    // Usamos solo where('date') sin orderBy en campo distinto para evitar
    // que Firestore exija un índice compuesto. Luego ordenamos en memoria.
    // T-19: en exportaciones se aplica un .limit() duro para no cargar de más.
    let query: Query = firestore.collection('entry_logs');
    if (date) {
      query = query.where('date', '==', date);
    } else if (from && to) {
      query = query.where('date', '>=', from).where('date', '<=', to);
    }
    if (isExport) {
      query = query.limit(MAX_EXPORT_ROWS + 1);
    }
    const querySnap = await query.get();

    // Mapear todos los docs y ordenar por timestamp descendente en memoria
    const allDocs = querySnap.docs.map((doc) => {
      const d = doc.data();
      const ts = d.timestamp?.toDate ? d.timestamp.toDate() : new Date(0);
      return {
        id: doc.id,
        userId: d.userId,
        userName: d.userName,
        // Minimización: recepción no necesita el correo completo del socio.
        userEmail: maskEmail(d.userEmail),
        hasPlanActivo: d.hasPlanActivo,
        planNombre: d.planNombre,
        timestamp: ts,
        timestampISO: ts.toISOString(),
        date: d.date,
      };
    }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // T-19: tope de filas para exportación (evita payloads/OOM gigantes).
    if (isExport && allDocs.length > MAX_EXPORT_ROWS) {
      return NextResponse.json(
        { error: `Demasiados registros (más de ${MAX_EXPORT_ROWS}). Acota el rango de fechas.` },
        { status: 413 }
      );
    }

    // ─── Exportación completa (sin paginación) ───
    if (isExport) {
      const allEntries = allDocs.map((e) => ({
        id: e.id,
        userName: e.userName,
        userEmail: e.userEmail,
        hasPlanActivo: e.hasPlanActivo,
        planNombre: e.planNombre || 'N/A',
        fecha: e.date,
        hora: formatInAppTz(e.timestamp, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      }));

      if (format === 'json') {
        return new NextResponse(JSON.stringify(allEntries, null, 2), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="entradas_${date || 'todas'}.json"`,
          },
        });
      }

      // Excel (exceljs — reemplaza xlsx, que está abandonado y con CVEs sin fix)
      const wsData = [
        ['Nombre', 'Correo', 'Plan Activo', 'Plan', 'Fecha', 'Hora'],
        ...allEntries.map((e) => [
          e.userName,
          e.userEmail,
          e.hasPlanActivo ? 'Sí' : 'No',
          e.planNombre,
          e.fecha,
          e.hora,
        ]),
      ];
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Entradas');
      worksheet.columns = [
        { width: 25 }, { width: 30 }, { width: 12 }, { width: 20 }, { width: 12 }, { width: 10 },
      ];
      worksheet.addRows(wsData);
      const buf = await workbook.xlsx.writeBuffer();

      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="entradas_${date || 'todas'}.xlsx"`,
        },
      });
    }

    // ─── Consulta paginada (en memoria) ───
    const totalCount = allDocs.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const offset = (page - 1) * pageSize;
    const pageEntries = allDocs.slice(offset, offset + pageSize);

    const entries = pageEntries.map((e) => ({
      id: e.id,
      userId: e.userId,
      userName: e.userName,
      userEmail: e.userEmail,
      hasPlanActivo: e.hasPlanActivo,
      planNombre: e.planNombre,
      timestamp: e.timestampISO,
      date: e.date,
    }));

    return NextResponse.json({
      entries,
      totalCount,
      currentPage: page,
      totalPages,
      pageSize,
    });
  } catch (error: any) {
    console.error('Error en GET /api/recepcion/entry-log:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

