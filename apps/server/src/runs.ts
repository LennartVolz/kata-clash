import type { RunResponse, RunResult } from '@kata-clash/shared';

/** Obergrenze für mitgeschickte Konsolenausgaben (Bytes, grob als Zeichen). */
const MAX_OUTPUT_CHARS = 4000;

/** Wandelt das interne Runner-Ergebnis in die öffentliche API-Antwort. */
export function toRunResponse(result: RunResult): RunResponse {
  return {
    status: result.status,
    passedTests: result.passedTests,
    totalTests: result.totalTests,
    durationMs: result.durationMs,
    // Der Client sieht nur sichtbare Tests; versteckte bleiben serverseitig.
    tests: result.tests.map((test) => ({ ...test, hidden: false })),
    output: result.stderr.slice(-MAX_OUTPUT_CHARS),
    ...(result.error === undefined ? {} : { error: result.error }),
  };
}
