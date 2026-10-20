import { NextResponse } from 'next/server';
import { GATE_COOKIE } from '@/lib/gate-token';

export async function POST() {
  const response = NextResponse.json({ success: true }, { status: 200 });

  // Borrar la cookie de sesión del admin
  response.cookies.set('fitmania_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0, // Expiración inmediata
  });

  // También se cierra la puerta del panel (token firmado).
  response.cookies.set(GATE_COOKIE.admin, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
