'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import type { TotpSecret } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { finishTotpEnrollment, hasTotp, startTotpEnrollment } from '@/lib/mfa-client';

/**
 * Inscripción de la verificación en dos pasos (TOTP) del administrador (F1-13).
 * Cuando esté inscrita, activar ADMIN_REQUIRE_MFA=true en el servidor.
 */
export function MfaPanel() {
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [pending, setPending] = useState<{ secret: TotpSecret; qrUrl: string; key: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => auth.onAuthStateChanged((u) => setEnrolled(hasTotp(u))), []);

  const start = async () => {
    const user = auth.currentUser;
    if (!user) return toast.error('Inicia sesión en el sitio con tu cuenta de administrador.');
    setBusy(true);
    try {
      setPending(await startTotpEnrollment(user));
    } catch (err: any) {
      toast.error(
        err?.code === 'auth/requires-recent-login'
          ? 'Por seguridad, cierra sesión e inicia de nuevo antes de configurar la verificación.'
          : err?.code === 'auth/operation-not-allowed'
            ? 'TOTP no está habilitado en Firebase / Identity Platform.'
            : err?.message || 'No se pudo iniciar la configuración.'
      );
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    const user = auth.currentUser;
    if (!user || !pending) return;
    setBusy(true);
    try {
      await finishTotpEnrollment(user, pending.secret, code);
      setPending(null);
      setCode('');
      setEnrolled(true);
      toast.success('Verificación en dos pasos activada.');
    } catch (err: any) {
      toast.error(err?.code === 'auth/invalid-verification-code' ? 'Código incorrecto.' : err?.message || 'No se pudo confirmar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
      <h3 className="font-black uppercase italic text-xl mb-3 flex items-center gap-2"><KeyRound className="w-5 h-5" /> Verificación en dos pasos (TOTP)</h3>
      {enrolled === null ? (
        <p className="text-sm font-bold text-zinc-400">Comprobando…</p>
      ) : enrolled ? (
        <p className="text-sm font-bold text-green-700">Activa en tu cuenta. Con <code>ADMIN_REQUIRE_MFA=true</code> el panel la exige siempre.</p>
      ) : pending ? (
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="bg-white p-3 border-2 border-black"><QRCode value={pending.qrUrl} size={160} /></div>
          <div className="space-y-3 flex-1">
            <p className="text-sm font-bold">1. Escanea el código con Google Authenticator, Microsoft Authenticator o similar.</p>
            <p className="text-xs font-bold text-zinc-500 break-all">Clave manual: {pending.key}</p>
            <p className="text-sm font-bold">2. Escribe el código de 6 dígitos que muestra la app:</p>
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} className="border-2 border-black rounded-lg px-3 py-2 font-black tracking-widest w-32" />
              <button onClick={finish} disabled={busy || code.length !== 6} className="px-4 py-2 bg-red-600 text-white border-2 border-black rounded-lg font-black uppercase text-xs disabled:opacity-50">Confirmar</button>
            </div>
            <p className="text-[11px] font-bold text-zinc-500">Guarda la clave manual en un lugar seguro y offline: es tu respaldo si pierdes el teléfono.</p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm font-bold text-zinc-600 mb-3">Protege la cuenta del administrador con un código temporal además de la contraseña.</p>
          <button onClick={start} disabled={busy} className="px-4 py-2 bg-black text-white border-4 border-black rounded-xl font-black uppercase text-xs disabled:opacity-50">Configurar</button>
        </>
      )}
    </div>
  );
}
