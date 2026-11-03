import type { RunJob, RunResult } from '@kata-clash/shared';
import { describe, expect, it, vi } from 'vitest';

import { buildApp } from './app';

function fakeResult(job: RunJob): RunResult {
  return {
    status: 'passed',
    passedTests: job.tests.length,
    totalTests: job.tests.length,
    tests: job.tests.map((test) => ({
      id: test.id,
      name: test.name,
      hidden: test.hidden,
      passed: true,
      durationMs: 1,
    })),
    durationMs: 5,
    exitCode: 0,
    stdout: '{"status":"ok","results":[]}',
    stderr: '',
  };
}

describe('server', () => {
  it('GET /health liefert status ok', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('GET /katas liefert den Katalog ohne Lösungen', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/katas' });

    expect(res.statusCode).toBe(200);
    const { katas } = res.json() as { katas: Record<string, unknown>[] };
    expect(katas.length).toBeGreaterThanOrEqual(5);
    expect(katas[0]).toMatchObject({ slug: 'summe-bis-n', difficulty: 'easy' });
    expect(katas[0]).not.toHaveProperty('tests');
    expect(katas[0]).not.toHaveProperty('starterCode');
    await app.close();
  });

  it('GET /katas/:slug liefert nur sichtbare Tests und beide Sprachen', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/katas/summe-bis-n' });

    expect(res.statusCode).toBe(200);
    const kata = res.json() as {
      slug: string;
      visibleTests: number;
      totalTests: number;
      tests: { id: string; name: string }[];
      starterCode: Record<string, string>;
    };
    expect(kata.slug).toBe('summe-bis-n');
    expect(kata.tests).toHaveLength(kata.visibleTests);
    expect(kata.totalTests).toBeGreaterThan(kata.visibleTests);
    expect(
      kata.tests.every((test) => Object.keys(test).sort().join(',') === 'args,expected,id,name'),
    ).toBe(true);
    expect(kata.starterCode.javascript).toContain('function solve');
    expect(kata.starterCode.python).toContain('def solve');
    await app.close();
  });

  it('GET /katas/:slug antwortet mit 404 für unbekannte Slugs', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/katas/gibt-es-nicht' });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('POST /runs führt nur die sichtbaren Tests der Kata aus', async () => {
    const runJob = vi.fn(async (job: RunJob) => fakeResult(job));
    const app = buildApp({ runJob });

    const res = await app.inject({
      method: 'POST',
      url: '/runs',
      payload: {
        slug: 'summe-bis-n',
        language: 'javascript',
        code: 'function solve(n) { return n; }',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(runJob).toHaveBeenCalledOnce();
    const job = runJob.mock.calls[0]![0];
    expect(job.language).toBe('javascript');
    expect(job.functionName).toBe('solve');
    expect(job.timeLimitMs).toBe(300_000);
    expect(job.tests).toHaveLength(2);
    expect(job.tests.every((test) => !test.hidden)).toBe(true);
    expect(job.code).toContain('function solve');

    const body = res.json() as {
      status: string;
      passedTests: number;
      tests: { hidden: boolean }[];
    };
    expect(body.status).toBe('passed');
    expect(body.passedTests).toBe(2);
    expect(body.tests.every((test) => test.hidden === false)).toBe(true);
    await app.close();
  });

  it('POST /runs antwortet mit 404 für unbekannte Katas', async () => {
    const runJob = vi.fn(async (job: RunJob) => fakeResult(job));
    const app = buildApp({ runJob });

    const res = await app.inject({
      method: 'POST',
      url: '/runs',
      payload: { slug: 'gibt-es-nicht', language: 'python', code: 'def solve(): pass' },
    });

    expect(res.statusCode).toBe(404);
    expect(runJob).not.toHaveBeenCalled();
    await app.close();
  });

  it('POST /runs antwortet mit 400 bei ungültigem Body', async () => {
    const app = buildApp({ runJob: vi.fn() });
    const res = await app.inject({
      method: 'POST',
      url: '/runs',
      payload: { slug: 'summe-bis-n', language: 'cobol', code: '' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as { issues: string[] };
    expect(body.issues.length).toBeGreaterThan(0);
    await app.close();
  });

  it('POST /runs antwortet mit 502, wenn der Runner nicht erreichbar ist', async () => {
    const app = buildApp({
      runJob: async () => {
        throw new Error('Docker nicht verfügbar');
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/runs',
      payload: { slug: 'summe-bis-n', language: 'javascript', code: 'function solve() {}' },
    });

    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({ error: 'Docker nicht verfügbar' });
    await app.close();
  });
});
