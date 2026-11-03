import Fastify from 'fastify';

import { findKata, listKataSummaries, toKataDetail } from '@kata-clash/katas';
import { startRunSchema, type RunJob } from '@kata-clash/shared';

import { runJobInSandbox, type RunJobFn } from './runner';
import { toRunResponse } from './runs';

export interface BuildAppOptions {
  /** In Tests ersetzbar; im Betrieb läuft der Job in der Sandbox. */
  runJob?: RunJobFn;
}

export function buildApp({ runJob = runJobInSandbox }: BuildAppOptions = {}) {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/katas', async () => ({ katas: listKataSummaries() }));

  app.get('/katas/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const kata = findKata(slug);
    if (!kata) {
      return reply.code(404).send({ error: `Kata '${slug}' nicht gefunden` });
    }
    return toKataDetail(kata);
  });

  app.post('/runs', async (request, reply) => {
    const parsed = startRunSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Ungültige Anfrage',
        issues: parsed.error.issues.map(
          (issue) => `${issue.path.join('.') || '<body>'}: ${issue.message}`,
        ),
      });
    }

    const kata = findKata(parsed.data.slug);
    if (!kata) {
      return reply.code(404).send({ error: `Kata '${parsed.data.slug}' nicht gefunden` });
    }

    // Nur sichtbare Tests: versteckte Tests bewerten erst das Duell (Phase 4).
    const job: RunJob = {
      language: parsed.data.language,
      code: parsed.data.code,
      functionName: kata.functionName,
      tests: kata.tests.filter((test) => !test.hidden),
      timeLimitMs: kata.timeLimitSec * 1000,
    };

    try {
      return toRunResponse(await runJob(job));
    } catch (error) {
      request.log.error(error);
      return reply.code(502).send({
        error: error instanceof Error ? error.message : 'Runner nicht erreichbar',
      });
    }
  });

  return app;
}
