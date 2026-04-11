import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Leer cookies de sesión
  const adminSession = request.cookies.get('fitmania_session')?.value;
  const receptionSession = request.cookies.get('fitmania_reception_session')?.value;

  // -------------------------------------------------------
  // RUTAS API DE ADMIN — requieren cookie fitmania_session
  // -------------------------------------------------------
  const isAdminApi = pathname.startsWith('/api/admin/') &&
    // Excluir los endpoints de login/logout (son los que CREAN la sesión)
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
    // Proteger todas las rutas de API admin y recepción
    '/api/admin/:path*',
    '/api/recepcion/:path*',
  ],
};
