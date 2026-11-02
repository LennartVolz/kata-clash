import { spawn } from 'node:child_process';

import type { SandboxLimits } from './config';

/** UID/GID des Sandbox-Nutzers in den Runner-Images. */
export const SANDBOX_USER = '10001:10001';

/** Nach einem `docker kill` bleibt dem Container so viel Zeit, bis hart entfernt wird. */
const KILL_GRACE_MS = 3_000;

export interface SandboxRunSpec {
  binary: string;
  name: string;
  image: string;
  command: string[];
  /** Host-Verzeichnis mit Nutzercode und Harness-Eingabe; wird read-only gemountet. */
  workDir: string;
  limits: SandboxLimits;
  env?: Record<string, string>;
}

export interface SandboxRunResult {
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  outputTruncated: boolean;
}

/**
 * Baut die `docker run`-Argumente inklusive aller Härtungs-Flags aus
 * docs/SECURITY.md. Reine Funktion, damit die Flags testbar sind.
 */
export function buildDockerArgs(spec: SandboxRunSpec): string[] {
  const { limits } = spec;
  return [
    'run',
    '--rm',
    '--name',
    spec.name,
    '--network',
    'none',
    '--read-only',
    '--tmpfs',
    `/tmp:rw,noexec,nosuid,nodev,size=${limits.tmpfsMb}m`,
    '--memory',
    `${limits.memoryMb}m`,
    '--memory-swap',
    `${limits.memoryMb}m`,
    '--cpus',
    String(limits.cpus),
    '--pids-limit',
    String(limits.pidsLimit),
    '--ulimit',
    `nofile=${limits.maxOpenFiles}:${limits.maxOpenFiles}`,
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--init',
    '--user',
    SANDBOX_USER,
    '-v',
    `${spec.workDir}:/work:ro`,
    '-w',
    '/work',
    ...Object.entries(spec.env ?? {}).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
    spec.image,
    ...spec.command,
  ];
}

class BoundedBuffer {
  readonly #chunks: Buffer[] = [];
  readonly #maxBytes: number;
  #size = 0;
  truncated = false;

  constructor(maxBytes: number) {
    this.#maxBytes = maxBytes;
  }

  push(chunk: Buffer): void {
    if (this.#size >= this.#maxBytes) {
      this.truncated = true;
      return;
    }
    const room = this.#maxBytes - this.#size;
    if (chunk.length > room) {
      this.#chunks.push(chunk.subarray(0, room));
      this.#size = this.#maxBytes;
      this.truncated = true;
      return;
    }
    this.#chunks.push(chunk);
    this.#size += chunk.length;
  }

  toString(): string {
    return Buffer.concat(this.#chunks).toString('utf8');
  }
}

function runDetached(binary: string, args: string[]): void {
  try {
    spawn(binary, args, { stdio: 'ignore' }).on('error', () => {});
  } catch {
    // Aufräumen ist Best-Effort; der Exit-Pfad entscheidet über das Ergebnis.
  }
}

/** Prüft, ob Docker (Daemon) erreichbar ist. */
export async function isDockerAvailable(binary = 'docker'): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const child = spawn(binary, ['version', '--format', '{{.Server.Version}}'], {
      stdio: 'ignore',
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(false);
    }, 5_000);
    child.on('error', () => finish(false));
    child.on('close', (code) => finish(code === 0));
  });
}

/** Prüft, ob ein Runner-Image lokal vorhanden ist. */
export async function imageExists(image: string, binary = 'docker'): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const child = spawn(binary, ['image', 'inspect', image], { stdio: 'ignore' });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(false);
    }, 5_000);
    child.on('error', () => finish(false));
    child.on('close', (code) => finish(code === 0));
  });
}

/** Führt einen Container mit Limits aus und liefert eine begrenzte Ausgabe zurück. */
export async function runSandbox(spec: SandboxRunSpec): Promise<SandboxRunResult> {
  const startedAt = Date.now();
  const args = buildDockerArgs(spec);
  const { limits } = spec;

  return await new Promise<SandboxRunResult>((resolve, reject) => {
    const child = spawn(spec.binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = new BoundedBuffer(limits.maxOutputBytes);
    const stderr = new BoundedBuffer(limits.maxOutputBytes);
    let timedOut = false;
    let settled = false;
    let graceTimer: NodeJS.Timeout | undefined;

    const finish = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (graceTimer) clearTimeout(graceTimer);
      resolve({
        exitCode,
        timedOut,
        durationMs: Date.now() - startedAt,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        outputTruncated: stdout.truncated || stderr.truncated,
      });
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      runDetached(spec.binary, ['kill', spec.name]);
      graceTimer = setTimeout(() => {
        // Container hängt weiterhin: hart entfernen und den Lauf abschließen.
        runDetached(spec.binary, ['rm', '-f', spec.name]);
        finish(null);
      }, KILL_GRACE_MS);
    }, limits.timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (graceTimer) clearTimeout(graceTimer);
      reject(new Error(`Docker konnte nicht gestartet werden: ${error.message}`));
    });

    child.on('close', (code) => finish(code));
  });
}
