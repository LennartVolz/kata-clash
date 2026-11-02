'use strict';

/**
 * Test-Harness für JavaScript-Katas. Läuft im Sandbox-Container.
 *
 * Vertrag: liest /work/input.json und /work/solution.cjs, ruft die Nutzerfunktion
 * für jede Testeingabe auf und schreibt genau eine JSON-Zeile auf stdout.
 * Erwartungswerte kennt das Harness nicht – der Vergleich passiert im Runner.
 */
const fs = require('node:fs');
const util = require('node:util');
const vm = require('node:vm');

const INPUT_PATH = process.env.KATA_INPUT ?? '/work/input.json';
const CODE_PATH = process.env.KATA_CODE ?? '/work/solution.cjs';

// stdout gehört dem Harness: Ausgaben des Nutzercodes gehen nach stderr,
// damit sie die JSON-Antwort nicht verfälschen können.
const realStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, callback) =>
  process.stderr.write(chunk, encoding, callback);

const log = (...args) => process.stderr.write(`${util.format(...args)}\n`);
console.log = log;
console.info = log;
console.debug = log;
console.trace = log;

// Ein vorzeitiges Beenden würde das Ergebnis verschlucken.
process.exit = (code) => {
  throw new Error(`process.exit(${code}) ist in der Sandbox blockiert`);
};
process.on('uncaughtException', (error) => log('Uncaught exception:', describe(error)));
process.on('unhandledRejection', (error) => log('Unhandled rejection:', describe(error)));

function describe(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function safeJson(value) {
  const json = JSON.stringify(value);
  return json === undefined ? 'null' : json;
}

/** Nutzercode laden und die zu testende Funktion heraussuchen. */
function loadSolution(functionName) {
  const source = fs.readFileSync(CODE_PATH, 'utf8');
  const name = JSON.stringify(functionName);
  const driver = `
;globalThis.__kataSolution = (() => {
  try {
    if (typeof ${functionName} === 'function') return ${functionName};
  } catch {}
  const exported = globalThis.module && globalThis.module.exports;
  if (exported && typeof exported[${name}] === 'function') return exported[${name}];
  if (typeof exported === 'function') return exported;
  return undefined;
})();`;

  globalThis.module = { exports: {} };
  globalThis.require = require;

  const script = new vm.Script(`${source}\n${driver}`, { filename: 'solution.cjs' });
  script.runInThisContext();

  const solution = globalThis.__kataSolution;
  if (typeof solution !== 'function') {
    throw new Error(`Funktion '${functionName}' nicht gefunden`);
  }
  return solution;
}

async function main() {
  const input = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
  const tests = Array.isArray(input.tests) ? input.tests : [];

  let solution;
  try {
    solution = loadSolution(input.functionName);
  } catch (error) {
    const message = describe(error);
    return {
      status: 'load-error',
      error: message,
      results: tests.map((test) => ({ id: test.id, status: 'error', error: message })),
    };
  }

  const results = [];
  for (const test of tests) {
    const startedAt = Date.now();
    try {
      const value = await solution(...test.args);
      results.push({
        id: test.id,
        status: 'ok',
        json: safeJson(value),
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      results.push({
        id: test.id,
        status: 'error',
        error: describe(error),
        durationMs: Date.now() - startedAt,
      });
    }
  }
  return { status: 'ok', results };
}

main().then(
  (payload) => {
    realStdoutWrite(`${JSON.stringify(payload)}\n`);
  },
  (error) => {
    realStdoutWrite(
      `${JSON.stringify({ status: 'load-error', error: describe(error), results: [] })}\n`,
    );
  },
);
