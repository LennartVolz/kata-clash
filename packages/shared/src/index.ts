import { z } from 'zod';

export const LANGUAGES = ['javascript', 'python'] as const;
export const languageSchema = z.enum(LANGUAGES);
export type Language = z.infer<typeof languageSchema>;

/** Maximale Codegröße, die Client und Server akzeptieren (Bytes als Zeichen approximiert). */
export const MAX_CODE_LENGTH = 20_000;

export const queueJoinSchema = z.object({
  language: languageSchema,
});
export type QueueJoin = z.infer<typeof queueJoinSchema>;

export const codeSubmitSchema = z.object({
  matchId: z.string().min(1),
  code: z.string().max(MAX_CODE_LENGTH),
});
export type CodeSubmit = z.infer<typeof codeSubmitSchema>;

// --- Katas und Runner-Jobs (Phase 1) -----------------------------------------

/** Maximale Anzahl Testfälle pro Ausführung. */
export const MAX_TESTS_PER_RUN = 50;

/**
 * Ein Testfall einer Kata. `expected` wird nie in den Sandbox-Container gegeben:
 * der Container liefert nur die Rückgabewerte, der Vergleich passiert im Runner.
 */
export const kataTestCaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hidden: z.boolean().default(false),
  args: z.array(z.unknown()),
  expected: z.unknown(),
});
export type KataTestCase = z.infer<typeof kataTestCaseSchema>;

/** Job, den der Runner aus der Queue bekommt. */
export const runJobSchema = z.object({
  language: languageSchema,
  code: z.string().min(1).max(MAX_CODE_LENGTH),
  /** Name der Funktion, die der Spieler implementieren muss. */
  functionName: z
    .string()
    .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, 'Ungültiger Funktionsname')
    .default('solve'),
  tests: z.array(kataTestCaseSchema).min(1).max(MAX_TESTS_PER_RUN),
  /** Zeitlimit in Millisekunden; der Runner kappt es auf sein eigenes Maximum. */
  timeLimitMs: z.number().int().min(500).optional(),
});
export type RunJob = z.infer<typeof runJobSchema>;
export type RunJobInput = z.input<typeof runJobSchema>;

export const RUN_STATUSES = ['passed', 'failed', 'timeout', 'error'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export interface TestOutcome {
  id: string;
  name: string;
  hidden: boolean;
  passed: boolean;
  durationMs: number;
  /** Fehlermeldung des Harness (z. B. Exception im Nutzercode) oder `undefined`. */
  error?: string;
}

export interface RunResult {
  status: RunStatus;
  passedTests: number;
  totalTests: number;
  tests: TestOutcome[];
  /** Laufzeit der gesamten Ausführung inklusive Container-Start. */
  durationMs: number;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** Infrastrukturfehler (Docker nicht verfügbar, Image fehlt, OOM-Kill, ...). */
  error?: string;
}

// --- Katas und REST-API (Phase 2) --------------------------------------------

export const KATA_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export const kataDifficultySchema = z.enum(KATA_DIFFICULTIES);
export type KataDifficulty = z.infer<typeof kataDifficultySchema>;

/**
 * Eine Kata: Beschreibung, Starter-Code für beide Sprachen und Testfälle.
 * Versteckte Tests verlassen den Server nie.
 */
export const kataSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug muss kleingeschrieben sein und Bindestriche nutzen'),
  title: z.string().min(1),
  /** Reiner Text mit Zeilenumbrüchen; das Frontend rendert ihn ohne Markdown-Parser. */
  description: z.string().min(1),
  difficulty: kataDifficultySchema,
  /** Zeitlimit eines Duells in Sekunden. */
  timeLimitSec: z.number().int().min(30).max(1800),
  functionName: z
    .string()
    .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, 'Ungültiger Funktionsname')
    .default('solve'),
  starterCode: z.object({
    javascript: z.string().min(1),
    python: z.string().min(1),
  }),
  tests: z.array(kataTestCaseSchema).min(1).max(MAX_TESTS_PER_RUN),
});
export type Kata = z.infer<typeof kataSchema>;

/** Ein Testfall, wie ihn die API an den Client gibt (nur sichtbare Tests). */
export interface PublicTestCase {
  id: string;
  name: string;
  args: unknown[];
  expected: unknown;
}

export interface KataSummary {
  slug: string;
  title: string;
  difficulty: KataDifficulty;
  timeLimitSec: number;
  visibleTests: number;
  totalTests: number;
}

export interface KataDetail extends KataSummary {
  description: string;
  functionName: string;
  starterCode: Record<Language, string>;
  tests: PublicTestCase[];
}

/** Body von `POST /runs`: eine Lösung gegen die sichtbaren Tests einer Kata ausführen. */
export const startRunSchema = z.object({
  slug: z.string().min(1),
  language: languageSchema,
  code: z.string().min(1).max(MAX_CODE_LENGTH),
});
export type StartRun = z.infer<typeof startRunSchema>;

export interface RunResponse {
  status: RunStatus;
  passedTests: number;
  totalTests: number;
  durationMs: number;
  tests: TestOutcome[];
  /** Konsolenausgaben des Nutzercodes (Harness leitet sie nach stderr). */
  output: string;
  error?: string;
}

/**
 * Eingabe für das Harness im Container. Enthält bewusst keine Erwartungswerte,
 * damit versteckte Tests nicht aus der Sandbox ausgelesen werden können.
 */
export interface HarnessInput {
  functionName: string;
  tests: { id: string; args: unknown[] }[];
}

export interface HarnessTestResult {
  id: string;
  status: 'ok' | 'error';
  /** JSON-serialisierter Rückgabewert des Nutzercodes (nur bei `status: 'ok'`). */
  json?: string;
  error?: string;
  durationMs?: number;
}

export interface HarnessOutput {
  status: 'ok' | 'load-error';
  error?: string;
  results: HarnessTestResult[];
}

/** Stabile JSON-Form (Schlüssel sortiert), um Erwartungs- und Rückgabewert zu vergleichen. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value)) ?? 'null';
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return Object.fromEntries(entries.map(([key, entry]) => [key, sortKeys(entry)]));
  }
  return value;
}
