import { NextResponse } from 'next/server';

/**
 * Endpoint de seguridad para consultar el estado del rate limit desde el cliente.
 * El Middleware ya se encarga de inyectar los headers X-RateLimit-*
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'Consulta de seguridad completada'
  });
}

// También permitimos POST para mayor flexibilidad en formularios
export async function POST() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'Consulta de seguridad completada'
  });
}
