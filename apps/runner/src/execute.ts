import { randomUUID } from 'node:crypto';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  canonicalJson,
  runJobSchema,
  type HarnessInput,
  type HarnessOutput,
  type HarnessTestResult,
  type KataTestCase,
  type Language,
  type RunJob,
  type RunResult,
  type TestOutcome,
} from '@kata-clash/shared';

import { loadConfig, type RunnerConfig } from './config';
import { runSandbox, type SandboxRunResult } from './docker';

interface LanguageSetup {
  sourceFile: string;
  command: string[];
}

const LANGUAGE_SETUP: Record<Language, LanguageSetup> = {
  javascript: { sourceFile: 'solution.cjs', command: ['node', '/opt/kata/harness.cjs'] },
  python: { sourceFile: 'solution.py', command: ['python3', '/opt/kata/harness.py'] },
};

/**
 * Führt einen Kata-Job in einer frischen Sandbox aus.
 *
 * Erwartungswerte bleiben im Runner; der Container bekommt nur Code und Eingaben
 * und liefert die Rückgabewerte als JSON zurück.
 */
export async function executeRun(
  rawJob: unknown,
  config: RunnerConfig = loadConfig(),
): Promise<RunResult> {
  const parseResult = runJobSchema.safeParse(rawJob);
  if (!parseResult.success) {
    const details = parseResult.error.issues
      .map((issue) => `${issue.path.join('.') || '<job>'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Ungültiger Runner-Job: ${details}`);
  }
  const job: RunJob = parseResult.data;
  const setup = LANGUAGE_SETUP[job.language];
  const startedAt = Date.now();
  const workDir = await mkdtemp(join(tmpdir(), 'kata-run-'));

  try {
    // Der Container läuft als uid 10001 und muss die Dateien lesen können.
    await chmod(workDir, 0o755);
    const input: HarnessInput = {
      functionName: job.functionName,
      tests: job.tests.map((test) => ({ id: test.id, args: test.args })),
    };
    await writeFile(join(workDir, 'input.json'), JSON.stringify(input), { mode: 0o644 });
    await writeFile(join(workDir, setup.sourceFile), job.code, { mode: 0o644 });

    const timeoutMs = Math.min(job.timeLimitMs ?? config.limits.timeoutMs, config.limits.timeoutMs);
    const run = await runSandbox({
      binary: config.dockerBinary,
      name: `kata-run-${randomUUID().slice(0, 8)}`,
      image: config.images[job.language],
      command: setup.command,
      workDir,
      limits: { ...config.limits, timeoutMs },
      env: {
        KATA_INPUT: '/work/input.json',
        KATA_CODE: `/work/${setup.sourceFile}`,
      },
    });

    return toRunResult(job, run, Date.now() - startedAt);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function toRunResult(job: RunJob, run: SandboxRunResult, durationMs: number): RunResult {
  const base = {
    durationMs,
    exitCode: run.exitCode,
    stdout: run.stdout,
    stderr: run.stderr,
  };
  const harness = parseHarnessOutput(run.stdout);

  if (run.timedOut) {
    return {
      ...base,
      status: 'timeout',
      passedTests: 0,
      totalTests: job.tests.length,
      tests: job.tests.map((test) =>
        outcome(test, { id: test.id, status: 'error', error: 'Zeitlimit überschritten' }),
      ),
      error: 'Zeitlimit überschritten – Container wurde beendet',
    };
  }

  if (!harness) {
    const error = describeCrash(run);
    return {
      ...base,
      status: 'error',
      passedTests: 0,
      totalTests: job.tests.length,
      tests: job.tests.map((test) => outcome(test, { id: test.id, status: 'error', error })),
      error,
    };
  }

  const byId = new Map(harness.results.map((result) => [result.id, result]));
  const tests = job.tests.map((test) => outcome(test, byId.get(test.id)));
  const passedTests = tests.filter((test) => test.passed).length;
  const allPassed = passedTests === job.tests.length;

  return {
    ...base,
    status: allPassed ? 'passed' : 'failed',
    passedTests,
    totalTests: job.tests.length,
    tests,
    ...(harness.error === undefined ? {} : { error: harness.error }),
  };
}

function outcome(test: KataTestCase, result: HarnessTestResult | undefined): TestOutcome {
  const base = { id: test.id, name: test.name, hidden: test.hidden };
  if (!result) {
    return { ...base, passed: false, durationMs: 0, error: 'Kein Ergebnis vom Harness' };
  }
  if (result.status === 'error') {
    return {
      ...base,
      passed: false,
      durationMs: result.durationMs ?? 0,
      error: result.error ?? 'Unbekannter Fehler',
    };
  }
  return {
    ...base,
    passed: matchesExpected(result.json, test.expected),
    durationMs: result.durationMs ?? 0,
  };
}

function matchesExpected(json: string | undefined, expected: unknown): boolean {
  if (json === undefined) return false;
  try {
    return canonicalJson(JSON.parse(json)) === canonicalJson(expected);
  } catch {
    return false;
  }
}

/** Das Harness schreibt genau eine JSON-Zeile; alles andere wird ignoriert. */
function parseHarnessOutput(stdout: string): HarnessOutput | null {
  const line = stdout.trim().split('\n').filter(Boolean).pop();
  if (!line) return null;
  try {
    const parsed: unknown = JSON.parse(line);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('results' in parsed) ||
      !Array.isArray((parsed as { results: unknown }).results)
    ) {
      return null;
    }
    return parsed as HarnessOutput;
  } catch {
    return null;
  }
}

function describeCrash(run: SandboxRunResult): string {
  const detail = firstLine(run.stderr) || firstLine(run.stdout) || 'keine Ausgabe';
  if (run.exitCode === 137) {
    return `Container wurde durch ein Ressourcenlimit beendet (OOM/PIDs): ${detail}`;
  }
  if (run.exitCode === 125) {
    return `Sandbox konnte nicht gestartet werden (Image fehlt?): ${detail}`;
  }
  return `Sandbox endete mit Exit-Code ${run.exitCode ?? 'unbekannt'}: ${detail}`;
}

function firstLine(text: string): string {
  return text.trim().split('\n')[0]?.slice(0, 300) ?? '';
}
