/** Konfiguration für das Echtzeit-Gateway (Socket.IO, Matchmaking). */
export interface RealtimeConfig {
  authSecret: string;
  redisUrl: string;
  /** Origin der Web-App; nur dieser darf per CORS mit Cookies verbinden. */
  webOrigin: string;
  /** Countdown zwischen `match:found` und `match:start`. */
  countdownMs: number;
  /** Intervall, in dem die Warteschlange nach Paaren sucht. */
  queueTickMs: number;
  /** Start-Toleranz der Elo-Differenz beim Matchmaking. */
  eloRangeBase: number;
  /** Wachstum der Toleranz pro Sekunde Wartezeit. */
  eloRangeGrowthPerSec: number;
  /** Obergrenze der Toleranz. */
  eloRangeMax: number;
}

const DEFAULTS = {
  webOrigin: 'http://localhost:3000',
  countdownMs: 3_000,
  queueTickMs: 1_000,
  eloRangeBase: 100,
  eloRangeGrowthPerSec: 50,
  eloRangeMax: 1_000,
} as const;

/**
 * Ohne `AUTH_SECRET` und `REDIS_URL` bleibt das Gateway aus; die REST-API läuft
 * weiter. Fehlerhafte Zahlenwerte brechen den Start dagegen bewusst ab.
 */
export function loadRealtimeConfig(env: NodeJS.ProcessEnv = process.env): RealtimeConfig | null {
  const authSecret = env.AUTH_SECRET?.trim();
  const redisUrl = env.REDIS_URL?.trim();
  if (!authSecret || !redisUrl) return null;

  return {
    authSecret,
    redisUrl,
    webOrigin: env.WEB_ORIGIN?.trim() || DEFAULTS.webOrigin,
    countdownMs: positiveInt(env, 'MATCH_COUNTDOWN_MS', DEFAULTS.countdownMs),
    queueTickMs: positiveInt(env, 'MATCHMAKING_TICK_MS', DEFAULTS.queueTickMs),
    eloRangeBase: positiveInt(env, 'MATCHMAKING_ELO_BASE', DEFAULTS.eloRangeBase),
    eloRangeGrowthPerSec: positiveInt(env, 'MATCHMAKING_ELO_GROWTH', DEFAULTS.eloRangeGrowthPerSec),
    eloRangeMax: positiveInt(env, 'MATCHMAKING_ELO_MAX', DEFAULTS.eloRangeMax),
  };
}

function positiveInt(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} muss eine positive ganze Zahl sein (war: "${raw}")`);
  }
  return value;
}
