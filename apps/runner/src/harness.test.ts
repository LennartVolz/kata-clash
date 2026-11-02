import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';
import type { HarnessOutput } from '@kata-clash/shared';

const execFileAsync = promisify(execFile);

const JS_HARNESS = resolve(import.meta.dirname, '../../../docker/harness/javascript/harness.cjs');
const PY_HARNESS = resolve(import.meta.dirname, '../../../docker/harness/python/harness.py');

interface HarnessRun {
  output: HarnessOutput;
  stdout: string;
  python?: boolean;
}

/** Startet ein Harness direkt (ohne Docker), um den JSON-Vertrag zu prüfen. */
async function runHarness(options: {
  language: 'javascript' | 'python';
  code: string;
  tests: { id: string; args: unknown[] }[];
  functionName?: string;
}): Promise<HarnessRun> {
  const dir = await mkdtemp(join(tmpdir(), 'kata-harness-'));
  try {
    const sourceFile = options.language === 'javascript' ? 'solution.cjs' : 'solution.py';
    await writeFile(join(dir, sourceFile), options.code);
    await writeFile(
      join(dir, 'input.json'),
      JSON.stringify({
        functionName: options.functionName ?? 'solve',
        tests: options.tests,
      }),
    );

    const { stdout } = await execFileAsync(
      options.language === 'javascript' ? 'node' : 'python3',
      [options.language === 'javascript' ? JS_HARNESS : PY_HARNESS],
      {
        env: {
          ...process.env,
          KATA_CODE: join(dir, sourceFile),
          KATA_INPUT: join(dir, 'input.json'),
        },
        timeout: 10_000,
      },
    );

    return { output: JSON.parse(stdout.trim()) as HarnessOutput, stdout };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const hasPython = await execFileAsync('python3', ['--version']).then(
  () => true,
  () => false,
);

describe('JavaScript-Harness', () => {
  it('liefert pro Testfall den JSON-Rückgabewert', async () => {
    const { output, stdout } = await runHarness({
      language: 'javascript',
      code: 'function solve(a, b) { return a + b; }',
      tests: [
        { id: 't1', args: [1, 2] },
        { id: 't2', args: [-5, 5] },
      ],
    });

    expect(stdout.trim().split('\n')).toHaveLength(1);
    expect(output.status).toBe('ok');
    expect(output.results).toEqual([
      expect.objectContaining({ id: 't1', status: 'ok', json: '3' }),
      expect.objectContaining({ id: 't2', status: 'ok', json: '0' }),
    ]);
  });

  it('unterstützt async-Funktionen und lässt console-Ausgaben stdout sauber', async () => {
    const { output, stdout } = await runHarness({
      language: 'javascript',
      code: [
        'async function solve(value) {',
        "  console.log('debug output');",
        '  await Promise.resolve();',
        '  return { value };',
        '}',
      ].join('\n'),
      tests: [{ id: 't1', args: [42] }],
    });

    expect(stdout.trim().split('\n')).toHaveLength(1);
    expect(output.results[0]).toEqual(
      expect.objectContaining({ status: 'ok', json: '{"value":42}' }),
    );
  });

  it('meldet Exceptions im Nutzercode als Fehler des Testfalls', async () => {
    const { output } = await runHarness({
      language: 'javascript',
      code: 'function solve() { throw new TypeError("kaputt"); }',
      tests: [{ id: 't1', args: [] }],
    });

    expect(output.status).toBe('ok');
    expect(output.results[0]).toEqual(
      expect.objectContaining({ status: 'error', error: 'TypeError: kaputt' }),
    );
  });

  it('meldet eine fehlende Funktion als Ladefehler', async () => {
    const { output } = await runHarness({
      language: 'javascript',
      code: 'function etwasAnderes() { return 1; }',
      tests: [{ id: 't1', args: [] }],
    });

    expect(output.status).toBe('load-error');
    expect(output.error).toContain("Funktion 'solve' nicht gefunden");
    expect(output.results).toEqual([
      expect.objectContaining({ id: 't1', status: 'error', error: expect.any(String) }),
    ]);
  });

  it('blockiert process.exit und liefert trotzdem ein Ergebnis', async () => {
    const { output, stdout } = await runHarness({
      language: 'javascript',
      code: 'function solve() { process.exit(0); }',
      tests: [{ id: 't1', args: [] }],
    });

    expect(stdout.trim().split('\n')).toHaveLength(1);
    expect(output.results[0]).toEqual(
      expect.objectContaining({ status: 'error', error: expect.stringContaining('blockiert') }),
    );
  });
});

describe.skipIf(!hasPython)('Python-Harness', () => {
  it('liefert pro Testfall den JSON-Rückgabewert', async () => {
    const { output, stdout } = await runHarness({
      language: 'python',
      code: ['def solve(a, b):', '    print("debug")', '    return a + b'].join('\n'),
      tests: [
        { id: 't1', args: [1, 2] },
        { id: 't2', args: [-5, 5] },
      ],
    });

    expect(stdout.trim().split('\n')).toHaveLength(1);
    expect(output.results).toEqual([
      expect.objectContaining({ id: 't1', status: 'ok', json: '3' }),
      expect.objectContaining({ id: 't2', status: 'ok', json: '0' }),
    ]);
  });

  it('meldet Exceptions und fehlende Funktionen', async () => {
    const throwing = await runHarness({
      language: 'python',
      code: ['def solve():', '    raise ValueError("kaputt")'].join('\n'),
      tests: [{ id: 't1', args: [] }],
    });
    expect(throwing.output.results[0]).toEqual(
      expect.objectContaining({ status: 'error', error: 'ValueError: kaputt' }),
    );

    const missing = await runHarness({
      language: 'python',
      code: 'def etwas_anderes():\n    return 1',
      tests: [{ id: 't1', args: [] }],
    });
    expect(missing.output.status).toBe('load-error');
    expect(missing.output.error).toContain("Funktion 'solve' nicht gefunden");
  });
});
