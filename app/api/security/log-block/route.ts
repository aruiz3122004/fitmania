import { NextResponse } from 'next/server';
import { recordAuditLog } from '@/lib/audit-logger';

export async function POST(request: Request) {
  try {
    const internalSecret = request.headers.get('x-middleware-secret');
    
    // Proteger este endpoint para que solo el middleware propio pueda invocarlo
    if (internalSecret !== (process.env.UPSTASH_REDIS_REST_TOKEN || 'fitmania_fallback')) {
        return NextResponse.json({ error: 'Acceso Denegado' }, { status: 403 });
    }

    const body = await request.json();
    const { ip, attempts, url } = body;

    await recordAuditLog({
      action: 'RATE_LIMIT_LOCK',
      category: 'SECURITY_BLOCK',
      details: `Bloqueo de seguridad activado por exceso de intentos (${attempts} fallos). Ruta atacada: ${url}`,
      adminEmail: `Anónimo (IP: ${ip})`,
      targetId: ip,
      request: request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error logeando bloqueo' }, { status: 500 });
  }
}
