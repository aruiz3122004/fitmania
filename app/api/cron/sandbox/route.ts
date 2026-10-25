import { NextResponse } from 'next/server';
import { timingSafeEqualStrings } from '@/lib/gate-token';
import { nightlySandboxMaintenance, sandboxOnly } from '@/lib/sandbox/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Cron diario del sandbox: cierra visitas vencidas y reinicia los datos si no hay nadie. */
export async function GET(request: Request) {
  const notHere = sandboxOnly();
  if (notHere) return notHere;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !timingSafeEqualStrings(request.headers.get('authorization') || '', `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    return NextResponse.json(await nightlySandboxMaintenance());
  } catch (error) {
    console.error('[cron/sandbox]', error);
    return NextResponse.json({ error: 'Falló el mantenimiento del sandbox.' }, { status: 500 });
  }
}
