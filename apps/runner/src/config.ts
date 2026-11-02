import type { Language } from '@kata-clash/shared';

/** Harte Grenzen für jede Sandbox-Ausführung (siehe docs/SECURITY.md). */
export interface SandboxLimits {
  /** Wanduhr-Limit pro Ausführung; danach wird der Container gekillt. */
  timeoutMs: number;
  memoryMb: number;
  cpus: number;
  pidsLimit: number;
  /** Maximale Ausgabegröße pro Stream; alles danach wird abgeschnitten. */
  maxOutputBytes: number;
  /** Größe des tmpfs auf /tmp (Root-Dateisystem ist read-only). */
  tmpfsMb: number;
  maxOpenFiles: number;
}

export const DEFAULT_LIMITS: SandboxLimits = {
  timeoutMs: 15_000,
  memoryMb: 256,
  cpus: 1,
  pidsLimit: 64,
  maxOutputBytes: 64 * 1024,
  tmpfsMb: 16,
  maxOpenFiles: 64,
};

export const DEFAULT_IMAGES: Record<Language, string> = {
  javascript: 'kata-clash/js:latest',
  python: 'kata-clash/python:latest',
};

export interface RunnerConfig {
  dockerBinary: string;
  images: Record<Language, string>;
  limits: SandboxLimits;
}

function positiveNumber(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  { integer = false } = {},
): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} muss eine positive Zahl sein (war: "${raw}")`);
  }
  if (integer && !Number.isInteger(value)) {
    throw new Error(`${name} muss eine ganze Zahl sein (war: "${raw}")`);
  }
  return value;
}

/** Liest die Runner-Konfiguration aus der Umgebung (alles optional). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): RunnerConfig {
  return {
    dockerBinary: env.RUNNER_DOCKER?.trim() || 'docker',
    images: {
      javascript: env.RUNNER_JS_IMAGE?.trim() || DEFAULT_IMAGES.javascript,
      python: env.RUNNER_PYTHON_IMAGE?.trim() || DEFAULT_IMAGES.python,
    },
    limits: {
      timeoutMs: positiveNumber(env, 'RUNNER_TIMEOUT_MS', DEFAULT_LIMITS.timeoutMs, {
        integer: true,
      }),
      memoryMb: positiveNumber(env, 'RUNNER_MEMORY_MB', DEFAULT_LIMITS.memoryMb, { integer: true }),
      cpus: positiveNumber(env, 'RUNNER_CPUS', DEFAULT_LIMITS.cpus),
      pidsLimit: positiveNumber(env, 'RUNNER_PIDS_LIMIT', DEFAULT_LIMITS.pidsLimit, {
        integer: true,
      }),
      maxOutputBytes: positiveNumber(
        env,
        'RUNNER_MAX_OUTPUT_BYTES',
        DEFAULT_LIMITS.maxOutputBytes,
        {
          integer: true,
        },
      ),
      tmpfsMb: positiveNumber(env, 'RUNNER_TMPFS_MB', DEFAULT_LIMITS.tmpfsMb, { integer: true }),
      maxOpenFiles: positiveNumber(env, 'RUNNER_MAX_OPEN_FILES', DEFAULT_LIMITS.maxOpenFiles, {
        integer: true,
      }),
    },
  };
}
