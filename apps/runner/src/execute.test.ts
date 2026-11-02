import { describe, expect, it } from 'vitest';
import type { RunJobInput } from '@kata-clash/shared';

import { loadConfig } from './config';
import { imageExists, isDockerAvailable } from './docker';
import { executeRun } from './execute';

// Diese Tests brauchen einen erreichbaren Docker-Daemon und gebaute Images
// (`pnpm runner:images`). Ohne beides werden sie übersprungen; in der CI laufen sie mit.
const config = loadConfig();
const dockerAvailable = await isDockerAvailable(config.dockerBinary);
const imagesAvailable =
  dockerAvailable &&
  (await imageExists(config.images.javascript, config.dockerBinary)) &&
  (await imageExists(config.images.python, config.dockerBinary));

const fastLimits = { ...config.limits, timeoutMs: 5_000 };
const testConfig = { ...config, limits: fastLimits };

const sumTest = { id: 't1', name: 'addiert', args: [2, 3], expected: 5, hidden: false };

function job(overrides: Partial<RunJobInput> & Pick<RunJobInput, 'code'>): RunJobInput {
  return {
    language: 'javascript',
    functionName: 'solve',
    tests: [sumTest],
    timeLimitMs: 4_000,
    ...overrides,
  };
}

describe.skipIf(!imagesAvailable)('executeRun in der Sandbox', () => {
  it('besteht mit einer korrekten Lösung', async () => {
    const result = await executeRun(
      job({ code: 'function solve(a, b) {\n  return a + b;\n}' }),
      testConfig,
    );

    expect(result.status).toBe('passed');
    expect(result.passedTests).toBe(1);
    expect(result.totalTests).toBe(1);
    expect(result.exitCode).toBe(0);
  });

  it('erkennt eine falsche Lösung', async () => {
    const result = await executeRun(
      job({ code: 'function solve(a, b) {\n  return a - b;\n}' }),
      testConfig,
    );

    expect(result.status).toBe('failed');
    expect(result.passedTests).toBe(0);
    expect(result.tests[0]).toEqual(expect.objectContaining({ id: 't1', passed: false }));
  });

  it('gibt Erwartungswerte nicht in den Container', async () => {
    const result = await executeRun(
      job({
        code: [
          'const fs = require("node:fs");',
          'function solve() {',
          '  const raw = fs.readFileSync("/work/input.json", "utf8");',
          '  return Object.keys(JSON.parse(raw));',
          '}',
        ].join('\n'),
        tests: [{ id: 't1', name: 'nur Eingaben', args: [], expected: ['functionName', 'tests'] }],
      }),
      testConfig,
    );

    expect(result.status).toBe('passed');
  });

  it('killt eine Endlosschleife nach dem Zeitlimit', async () => {
    const result = await executeRun(
      job({ code: 'function solve() {\n  while (true) {}\n}', timeLimitMs: 1_500 }),
      testConfig,
    );

    expect(result.status).toBe('timeout');
    expect(result.durationMs).toBeLessThan(15_000);
  });

  it('stoppt eine Speicherbombe per OOM-Limit', async () => {
    const result = await executeRun(
      job({
        code: 'function solve() {\n  const chunks = [];\n  while (true) chunks.push(Buffer.alloc(8 * 1024 * 1024, 1));\n}',
      }),
      testConfig,
    );

    // Je nach Limit greift der cgroup-OOM-Kill oder V8 bricht selbst ab – beides ist ein Fehler.
    expect(result.status).not.toBe('passed');
    expect(result.passedTests).toBe(0);
  });

  it('verhindert Netzwerkzugriffe', async () => {
    const result = await executeRun(
      job({
        code: 'async function solve() {\n  const res = await fetch("https://example.com");\n  return res.status;\n}',
        timeLimitMs: 3_000,
      }),
      testConfig,
    );

    expect(result.status).not.toBe('passed');
    expect(result.tests[0]?.passed).toBe(false);
    expect(result.tests[0]?.error).toMatch(/fetch|network|ENOTFOUND|EAI_AGAIN/i);
  });

  it('stoppt eine Fork-Bombe per PIDs-Limit', async () => {
    const result = await executeRun(
      job({
        code: [
          'const { spawn } = require("node:child_process");',
          'function solve() {',
          '  while (true) {',
          '    try {',
          '      spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);',
          '    } catch (error) {',
          '      return String(error);',
          '    }',
          '  }',
          '}',
        ].join('\n'),
        timeLimitMs: 2_000,
      }),
      testConfig,
    );

    expect(['error', 'failed', 'timeout']).toContain(result.status);
    expect(result.status).not.toBe('passed');
  });

  it('verweigert Schreibzugriff auf das read-only Root-Dateisystem', async () => {
    const result = await executeRun(
      job({
        code: [
          'const fs = require("node:fs");',
          'function solve() {',
          '  fs.writeFileSync("/opt/kata/harness.cjs", "manipuliert");',
          '  return "geschrieben";',
          '}',
        ].join('\n'),
      }),
      testConfig,
    );

    expect(result.status).toBe('failed');
    expect(result.tests[0]?.error).toMatch(/EROFS|read-only|EACCES/i);
  });

  it('führt Python-Katas im eigenen Image aus', async () => {
    const result = await executeRun(
      {
        language: 'python',
        functionName: 'solve',
        code: 'def solve(a, b):\n    return a + b\n',
        tests: [sumTest],
        timeLimitMs: 4_000,
      },
      testConfig,
    );

    expect(result.status).toBe('passed');
    expect(result.passedTests).toBe(1);
  });
});

describe('executeRun ohne Sandbox', () => {
  it('lehnt ungültige Jobs ab, bevor ein Container startet', async () => {
    await expect(
      executeRun({ language: 'ruby', code: 'x', tests: [sumTest] }, testConfig),
    ).rejects.toThrow(/Ungültiger Runner-Job/);
  });
});
