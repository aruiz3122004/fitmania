/**
 * Marco de color según el plan activo (avatar, menú de cuenta, membresía y foro).
 *
 *   estandar  → marco clásico rojo/blanco/azul
 *   parejas   → marco rosa/violeta (afinidad: pareja, amigos, compañeros de entreno)
 *   dosenuno  → marco dorado
 *
 * El tipo se toma del `planId` del plan y, si no lo tiene (planes asignados a mano),
 * del nombre. firestore.rules repite esta misma regla para `autor_plan_tier` del foro.
 */
export type PlanTier = 'estandar' | 'parejas' | 'dosenuno'

export const PLAN_TIERS: PlanTier[] = ['estandar', 'parejas', 'dosenuno']

export function planTier(plan?: { planId?: string | null; nombre?: string | null } | null): PlanTier {
  const id = plan?.planId
  if (id === 'parejas' || id === 'dosenuno' || id === 'estandar') return id
  const name = (plan?.nombre || '').toLowerCase()
  if (name.includes('pareja')) return 'parejas'
  if (/dos en uno|2 en 1/.test(name)) return 'dosenuno'
  return 'estandar'
}

export interface PlanFrame {
  label: string
  /** Degradado animado del marco (fondo que asoma alrededor del avatar o la tarjeta). */
  gradient: string
  glow: string
  /** Fondo claro del menú de cuenta. */
  panel: string
  /** Clases de la insignia de días restantes. */
  badge: string
  icon: string
  /** Color sólido para bordes y sombras de tarjetas oscuras. */
  solid: string
}

/** Marcos disponibles: los de cada plan más el del visitante del modo sandbox. */
export type FrameKey = PlanTier | 'sandbox'

export const PLAN_FRAMES: Record<FrameKey, PlanFrame> = {
  estandar: {
    label: 'Premium',
    gradient: 'linear-gradient(45deg, #ef4444, #ffffff, #3b82f6, #ef4444, #ffffff, #3b82f6)',
    glow: '0 0 12px rgba(220,38,38,0.4), 0 0 24px rgba(59,130,246,0.3)',
    panel: 'linear-gradient(135deg, #abd4f0ff 0%, #ffffff 50%, #e97373ff 100%)',
    badge: 'bg-blue-100 border-blue-400 text-blue-700 shadow-[3px_3px_0_0_rgba(59,130,246,0.3)]',
    icon: '⭐',
    solid: '#dc2626',
  },
  parejas: {
    label: 'Dúo',
    gradient: 'linear-gradient(45deg, #ec4899, #ffffff, #a855f7, #ec4899, #ffffff, #a855f7)',
    glow: '0 0 12px rgba(236,72,153,0.45), 0 0 24px rgba(168,85,247,0.3)',
    panel: 'linear-gradient(135deg, #fbcfe8 0%, #ffffff 50%, #ddd6fe 100%)',
    badge: 'bg-pink-100 border-pink-400 text-pink-700 shadow-[3px_3px_0_0_rgba(236,72,153,0.3)]',
    icon: '🤝',
    solid: '#ec4899',
  },
  dosenuno: {
    label: 'Gold',
    gradient: 'linear-gradient(45deg, #b45309, #fde68a, #f59e0b, #fffbeb, #d97706, #fde68a)',
    glow: '0 0 14px rgba(245,158,11,0.55), 0 0 28px rgba(234,179,8,0.35)',
    panel: 'linear-gradient(135deg, #fde68a 0%, #fffbeb 50%, #fcd34d 100%)',
    badge: 'bg-amber-100 border-amber-500 text-amber-800 shadow-[3px_3px_0_0_rgba(217,119,6,0.35)]',
    icon: '👑',
    solid: '#f59e0b',
  },
  // Insignia del modo sandbox: verde "laboratorio" con franjas de advertencia.
  sandbox: {
    label: 'Explorador',
    gradient: 'linear-gradient(45deg, #84cc16, #1e293b, #facc15, #22c55e, #1e293b, #a3e635)',
    glow: '0 0 14px rgba(132,204,22,0.6), 0 0 28px rgba(250,204,21,0.35)',
    panel: 'linear-gradient(135deg, #d9f99d 0%, #ffffff 50%, #fef08a 100%)',
    badge: 'bg-lime-100 border-lime-600 text-lime-900 shadow-[3px_3px_0_0_rgba(77,124,15,0.35)]',
    icon: '🧪',
    solid: '#65a30d',
  },
}
