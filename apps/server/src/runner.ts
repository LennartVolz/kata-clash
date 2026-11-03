import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type { RunJob, RunResult } from '@kata-clash/shared';

/**
 * Die API startet den Runner als eigenen Prozess (Phase 2). Ab Phase 4 übernimmt
 * die Redis-Queue diese Rolle; die Signatur bleibt dabei gleich.
 */
const RUNNER_ENTRY = fileURLToPath(new URL('../../runner/src/index.ts', import.meta.url));
const SERVER_DIR = fileURLToPath(new URL('..', import.meta.url));

/** Obergrenze für den gesamten Runner-Prozess; die Sandbox hat ihr eigenes Limit. */
const PROCESS_TIMEOUT_MS = 60_000;

export type RunJobFn = (job: RunJob) => Promise<RunResult>;

export class RunnerUnavailableError extends Error {}

export function runJobInSandbox(job: RunJob, timeoutMs = PROCESS_TIMEOUT_MS): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', RUNNER_ENTRY], {
      cwd: SERVER_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;

    const finish = (error: Error | null, result?: RunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(result as RunResult);
    };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new RunnerUnavailableError(`Runner nach ${timeoutMs} ms abgebrochen`));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

    child.on('error', (error) => {
      finish(new RunnerUnavailableError(`Runner konnte nicht gestartet werden: ${error.message}`));
    });

    child.on('close', (exitCode) => {
      const text = Buffer.concat(stdout).toString('utf8').trim();
      if (!text) {
        const detail = Buffer.concat(stderr).toString('utf8').trim().slice(0, 500);
        finish(
          new RunnerUnavailableError(`Runner lieferte kein Ergebnis: ${detail || 'keine Ausgabe'}`),
        );
        return;
      }

      const result = parseRunnerOutput(text);
      if (!result) {
        finish(new RunnerUnavailableError(`Runner-Ausgabe war kein JSON: ${text.slice(0, 300)}`));
        return;
      }
      finish(null, { ...result, exitCode: exitCode ?? result.exitCode });
    });

    child.stdin.end(JSON.stringify(job));
  });
}

/**
 * Der Runner schreibt ein eingerücktes JSON-Objekt nach stdout. Zusätzlich wird die
 * letzte Zeile versucht, falls davor Logzeilen auftauchen.
 */
function parseRunnerOutput(text: string): RunResult | null {
  const candidates = [text, text.split('\n').filter(Boolean).pop() ?? ''];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as RunResult;
      if (parsed && typeof parsed === 'object' && typeof parsed.status === 'string') {
        return parsed;
      }
    } catch {
      // nächste Variante versuchen
    }
  }
  return null;
}
