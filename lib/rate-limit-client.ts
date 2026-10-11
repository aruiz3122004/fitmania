/**
 * Utilidad para interactuar con el sistema de Rate Limit desde el Frontend.
 */

export interface RateLimitStatus {
  success: boolean;
  remaining: number;
  reset: number; // Timestamp en ms
  secondsLeft: number;
  message?: string;
}

/**
 * Consulta al servidor el estado actual del Rate Limit para la IP actual (SIN RESTAR INTENTOS).
 */
export async function getRateLimitStatus(): Promise<RateLimitStatus> {
  try {
    const response = await fetch('/api/security/check', { method: 'GET' });
    const data = await response.json();

    const remaining = data.remaining !== undefined ? data.remaining : parseInt(response.headers.get('X-RateLimit-Remaining') || '5');
    const secondsLeft = data.secondsLeft || 0;

    if (response.status === 429) {
      return {
        success: false,
        remaining: 0,
        reset: Date.now() + (secondsLeft * 1000),
        secondsLeft,
        message: data.error || 'Has excedido el límite de intentos.'
      };
    }

    return {
      success: true,
      remaining,
      reset: 0,
      secondsLeft: 0
    };
  } catch (error) {
    console.error('Error verificando Rate Limit:', error);
    return { success: true, remaining: 5, reset: 0, secondsLeft: 0 };
  }
}

/**
 * Notifica al servidor que el usuario intentó iniciar sesión o pagar, consumiendo 1 intento.
 */
export async function consumeRateLimitAttempt(): Promise<RateLimitStatus> {
  try {
    const response = await fetch('/api/security/attempt', { method: 'POST' });
    const data = await response.json();
    
    const remaining = data.remaining !== undefined ? data.remaining : parseInt(response.headers.get('X-RateLimit-Remaining') || '5');
    const secondsLeft = data.secondsLeft || parseInt(response.headers.get('X-RateLimit-SecondsLeft') || '0');

    if (response.status === 429 || !data.success) {
      return {
        success: false,
        remaining: 0,
        reset: Date.now() + (secondsLeft * 1000),
        secondsLeft,
        message: data.error || 'Límite de intentos excedido.'
      };
    }

    return {
      success: true,
      remaining,
      reset: 0,
      secondsLeft: 0
    };
  } catch (error) {
    console.error('Error consumiendo intento de Rate Limit:', error);
    return { success: true, remaining: 5, reset: 0, secondsLeft: 0 };
  }
}

/**
 * Limpia el historial de fallos del rate limit si el usuario ingresó correctamente.
 */
export async function clearRateLimit(): Promise<void> {
  try {
    await fetch('/api/security/success', { method: 'POST' });
  } catch (e) {
    console.error('Error limpiando rate limit:', e);
  }
}

/**
 * Formatea los segundos restantes en un formato amigable (MM:SS)
 */
export function formatTimeLeft(seconds: number): string {
  if (seconds <= 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
