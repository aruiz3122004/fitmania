import { NextResponse } from 'next/server';

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

  return response;
}
