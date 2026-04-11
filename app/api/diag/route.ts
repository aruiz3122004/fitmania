import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const adminAuth = getAdminAuth();
    // Intenta una operación básica que no requiera token pero valide credenciales
    await adminAuth.listUsers(1); 
    
    return NextResponse.json({ 
      status: 'success', 
      message: 'Firebase Admin conectado correctamente con .env.local'
    });
  } catch (error: any) {
    return NextResponse.json({ 
      status: 'error', 
      message: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
