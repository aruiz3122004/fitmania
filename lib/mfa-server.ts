import { NextResponse } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { sessionSatisfiesMfa, type MfaStateLike } from '@/lib/mfa';

/**
 * Lado servidor de la verificación en dos pasos por correo (ver lib/mfa.ts).
 * Lo usan las APIs del usuario y los logins de los paneles.
 */

export const MFA_STATE = 'mfa_state';
export const MFA_CHALLENGES = 'mfa_challenges';

export async function readMfaState(uid: string): Promise<(MfaStateLike & { recoveryHashes?: string[] }) | null> {
  const snap = await getAdminFirestore().collection(MFA_STATE).doc(uid).get();
  return snap.exists ? (snap.data() as MfaStateLike & { recoveryHashes?: string[] }) : null;
}

function secondFactorOf(decoded: DecodedIdToken): string | null {
  return (decoded.firebase as { sign_in_second_factor?: string } | undefined)?.sign_in_second_factor ?? null;
}

/** Estado de la verificación para la sesión del token. */
export async function getMfaStatus(decoded: DecodedIdToken) {
  const state = await readMfaState(decoded.uid);
  return {
    enabled: state?.enabled === true,
    verified: sessionSatisfiesMfa(state, decoded.auth_time, secondFactorOf(decoded)),
    recoveryRemaining: Array.isArray(state?.recoveryHashes) ? state!.recoveryHashes!.length : 0,
  };
}

/** ¿Puede esta sesión usar las APIs? (sin verificación activa siempre puede). */
export async function isMfaSatisfied(decoded: DecodedIdToken): Promise<boolean> {
  return (await getMfaStatus(decoded)).verified;
}

/** La sesión inició con contraseña pero falta el código: el cliente muestra la verificación. */
export function mfaRequiredResponse() {
  return NextResponse.json(
    { error: 'Completa la verificación en dos pasos para continuar.', code: 'mfa_required' },
    { status: 401 }
  );
}
