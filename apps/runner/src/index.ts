// CLI-Einstieg des Sandbox-Runners (Phase 1).
//
// Nutzung:
//   pnpm --filter @kata-clash/runner start fixtures/js-add.json
//   echo '{"language":"javascript", ...}' | pnpm --filter @kata-clash/runner start
//
// Der Queue-Betrieb über Redis folgt in Phase 4; die Ausführungslogik liegt in execute.ts.
import { readFile } from 'node:fs/promises';

import { loadConfig } from './config';
import { executeRun } from './execute';

async function readJobInput(path: string | undefined): Promise<unknown> {
  if (path) {
    return JSON.parse(await readFile(path, 'utf8')) as unknown;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) {
    throw new Error(
      'Kein Job übergeben. Nutzung: pnpm --filter @kata-clash/runner start <job.json> oder JSON über stdin.',
    );
  }
  return JSON.parse(text) as unknown;
}

try {
  const job = await readJobInput(process.argv[2]);
  const config = loadConfig();
  const result = await executeRun(job, config);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === 'error' ? 1 : 0;
} catch (error) {
  process.stderr.write(
    `Runner-Fehler: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
