import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import * as XLSX from 'xlsx';

// ─── POST: Registrar una nueva entrada ───
export async function POST(request: NextRequest) {
  try {
    // Verificar sesión del recepcionista
    const sessionCookie = request.cookies.get('fitmania_reception_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    try {
      await adminAuth.verifyIdToken(sessionCookie);
    } catch {
      return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, userName, userEmail, hasPlanActivo, planNombre } = body;

    if (!userId || !userName || !userEmail) {
      return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 });
    }

    const now = new Date();
    // Formato YYYY-MM-DD en zona local (Colombia UTC-5)
    const offsetMs = 5 * 60 * 60 * 1000;
    const localDate = new Date(now.getTime() - offsetMs);
    const dateStr = localDate.toISOString().split('T')[0];

    const firestore = getAdminFirestore();
    const entryRef = firestore.collection('entry_logs').doc();

    await entryRef.set({
      userId,
      userName,
      userEmail,
      hasPlanActivo: hasPlanActivo ?? false,
      planNombre: planNombre || null,
      timestamp: now,
      date: dateStr,
      authorizedBy: 'Recepcionista',
    });

    return NextResponse.json({ success: true, entryId: entryRef.id });
  } catch (error: any) {
    console.error('Error en POST /api/recepcion/entry-log:', error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}

// ─── GET: Consultar entradas con paginación y exportación ───
export async function GET(request: NextRequest) {
  try {
    // Verificar sesión del recepcionista
    const sessionCookie = request.cookies.get('fitmania_reception_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    try {
      await adminAuth.verifyIdToken(sessionCookie);
    } catch {
      return NextResponse.json({ error: 'Sesión inválida o expirada.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action'); // 'calendar' for getting days with entries
    const date = searchParams.get('date'); // YYYY-MM-DD
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.max(1, Math.min(200, parseInt(searchParams.get('pageSize') || '5')));
    const format = searchParams.get('format'); // 'json' | 'excel'

    const firestore = getAdminFirestore();

    // ─── Obtener días con entradas (para el calendario) ───
    if (action === 'calendar') {
      const month = searchParams.get('month'); // YYYY-MM
      let calQuery = firestore.collection('entry_logs').orderBy('date', 'desc');
      
      if (month) {
        // Filtrar por rango del mes: YYYY-MM-01 a YYYY-MM-31
        const startDate = `${month}-01`;
        const endDate = `${month}-31`;
        calQuery = firestore
          .collection('entry_logs')
          .where('date', '>=', startDate)
          .where('date', '<=', endDate)
          .orderBy('date', 'desc') as any;
      }

      const calSnap = await calQuery.get();
      const daysSet = new Set<string>();
      calSnap.docs.forEach((doc) => {
        const d = doc.data();
        if (d.date) daysSet.add(d.date);
      });

      return NextResponse.json({ days: Array.from(daysSet) });
    }

    // ─── Construir query sin índice compuesto ───
    // Usamos solo where('date') sin orderBy en campo distinto para evitar
    // que Firestore exija un índice compuesto. Luego ordenamos en memoria.
    let querySnap;
    if (date) {
      querySnap = await firestore
        .collection('entry_logs')
        .where('date', '==', date)
        .get();
    } else {
      querySnap = await firestore
        .collection('entry_logs')
        .get();
    }

    // Mapear todos los docs y ordenar por timestamp descendente en memoria
    const allDocs = querySnap.docs.map((doc) => {
      const d = doc.data();
      const ts = d.timestamp?.toDate ? d.timestamp.toDate() : new Date(0);
      return {
        id: doc.id,
        userId: d.userId,
        userName: d.userName,
        userEmail: d.userEmail,
        hasPlanActivo: d.hasPlanActivo,
        planNombre: d.planNombre,
        timestamp: ts,
        timestampISO: ts.toISOString(),
        date: d.date,
      };
    }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // ─── Exportación completa (sin paginación) ───
    if (format === 'json' || format === 'excel') {
      const allEntries = allDocs.map((e) => ({
        id: e.id,
        userName: e.userName,
        userEmail: e.userEmail,
        hasPlanActivo: e.hasPlanActivo,
        planNombre: e.planNombre || 'N/A',
        fecha: e.date,
        hora: e.timestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
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

      // Excel (xlsx)
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
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [
        { wch: 25 }, { wch: 30 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 10 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Entradas');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

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

