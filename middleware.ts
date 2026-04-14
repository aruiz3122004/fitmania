import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Leer cookies de sesión
  const adminSession = request.cookies.get('fitmania_session')?.value;
  const receptionSession = request.cookies.get('fitmania_reception_session')?.value;

  // -------------------------------------------------------
  // PROTECCIÓN DE PÁGINAS (ADMIN Y RECEPCIÓN)
  // -------------------------------------------------------
  
  // 1. Proteger ruta de ADMIN (/admin)
  if (pathname === '/admin') {
    const key = searchParams.get('key');
    const validKey = process.env.ADMIN_GATE_KEY;
    
    // Dejar pasar si tiene sesión válida O si viene con la llave correcta
    if (adminSession || (validKey && key === validKey)) {
      return NextResponse.next();
    }
    
    // En cualquier otro caso, fingir que la página no existe (404)
    return NextResponse.rewrite(new URL('/404', request.url));
  }

  // 2. Proteger ruta de RECEPCIÓN (/recepcion)
  if (pathname === '/recepcion') {
    const key = searchParams.get('key');
    const validKey = process.env.RECEPTION_GATE_KEY;
    
    if (receptionSession || (validKey && key === validKey)) {
      return NextResponse.next();
    }
    
    return NextResponse.rewrite(new URL('/404', request.url));
  }

  // -------------------------------------------------------
  // RUTAS API DE ADMIN — requieren cookie fitmania_session
  // -------------------------------------------------------
  const isAdminApi = pathname.startsWith('/api/admin/') &&
    !pathname.startsWith('/api/admin/login') &&
    !pathname.startsWith('/api/admin/logout');

  if (isAdminApi && !adminSession) {
    return NextResponse.json(
      { error: 'No autorizado. Debes iniciar sesión como administrador.' },
      { status: 401 }
    );
  }

  // -------------------------------------------------------
  // RUTAS API DE RECEPCIÓN — requieren cookie reception_session
  // -------------------------------------------------------
  const isRecepcionApi = pathname.startsWith('/api/recepcion/') &&
    !pathname.startsWith('/api/recepcion/login') &&
    !pathname.startsWith('/api/recepcion/logout');

  if (isRecepcionApi && !receptionSession) {
    return NextResponse.json(
      { error: 'No autorizado. Debes iniciar sesión como recepcionista.' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Páginas a proteger
    '/admin',
    '/recepcion',
    // Proteger todas las rutas de API admin y recepción
    '/api/admin/:path*',
    '/api/recepcion/:path*',
  ],
};
