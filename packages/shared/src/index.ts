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

// --- Live-Duelle (Phase 4) ---------------------------------------------------

/** Zeitstempel als Unix-Millisekunden, damit Client und Server zeitzonenfrei rechnen. */
const timestampSchema = z.number().int().nonnegative();

/** Öffentliche Gegner-Ansicht – ohne E-Mail oder andere Profildaten. */
export const opponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  elo: z.number().int(),
});
export type Opponent = z.infer<typeof opponentSchema>;

/** Grund für das Matchende. `solved` = alle Tests grün, `timeout` = Zeit abgelaufen. */
export const MATCH_END_REASONS = ['solved', 'timeout', 'forfeit', 'abandoned'] as const;
export const matchEndReasonSchema = z.enum(MATCH_END_REASONS);
export type MatchEndReason = z.infer<typeof matchEndReasonSchema>;

/** Ein sichtbarer Testfall, wie ihn ein Duell-Start mitliefert. */
export const publicTestCaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  args: z.array(z.unknown()),
  expected: z.unknown(),
});

/** Kata-Ansicht eines Duells: Beschreibung, Starter-Code und nur sichtbare Tests. */
export const duelKataSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  difficulty: kataDifficultySchema,
  timeLimitSec: z.number().int().min(30).max(1800),
  visibleTests: z.number().int().nonnegative(),
  totalTests: z.number().int().positive(),
  functionName: z.string().regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/),
  starterCode: z.object({
    javascript: z.string().min(1),
    python: z.string().min(1),
  }),
  tests: z.array(publicTestCaseSchema),
});
export type DuelKata = z.infer<typeof duelKataSchema>;

// Client -> Server

export const queueLeaveSchema = z.object({ language: languageSchema });
export type QueueLeave = z.infer<typeof queueLeaveSchema>;

export const codeRunSchema = z.object({
  matchId: z.string().min(1),
  code: z.string().max(MAX_CODE_LENGTH),
});
export type CodeRun = z.infer<typeof codeRunSchema>;

// Server -> Client

export const matchFoundSchema = z.object({
  matchId: z.string().min(1),
  opponent: opponentSchema,
  /** Beginn des Duells (Epoch ms); davor läuft der Countdown. */
  startsAt: timestampSchema,
});
export type MatchFound = z.infer<typeof matchFoundSchema>;

export const matchStartSchema = z.object({
  matchId: z.string().min(1),
  kata: duelKataSchema,
  startsAt: timestampSchema,
  endsAt: timestampSchema,
});
export type MatchStart = z.infer<typeof matchStartSchema>;

/** Einzelnes Testergebnis; Details versteckter Tests bleiben im Server. */
export const runTestOutcomeSchema: z.ZodType<TestOutcome> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hidden: z.boolean(),
  passed: z.boolean(),
  durationMs: z.number().nonnegative(),
  error: z.string().optional(),
});

export const runResultSchema = z.object({
  matchId: z.string().min(1),
  /** `run` prüft nur sichtbare Tests, `submit` alle. */
  kind: z.enum(['run', 'submit']),
  status: z.enum(RUN_STATUSES),
  passedTests: z.number().int().nonnegative(),
  totalTests: z.number().int().positive(),
  tests: z.array(runTestOutcomeSchema),
  durationMs: z.number().nonnegative(),
  output: z.string(),
  error: z.string().optional(),
});
export type RunResultEvent = z.infer<typeof runResultSchema>;

export const opponentProgressSchema = z.object({
  matchId: z.string().min(1),
  testsPassed: z.number().int().nonnegative(),
  totalTests: z.number().int().positive(),
});
export type OpponentProgress = z.infer<typeof opponentProgressSchema>;

export const matchEndSchema = z.object({
  matchId: z.string().min(1),
  /** `null` bei Remis. */
  winnerId: z.string().min(1).nullable(),
  reason: matchEndReasonSchema,
  /** Elo-Änderung aus Sicht des Empfängers; positiv = gewonnen. */
  eloDelta: z.number().int(),
  endedAt: timestampSchema,
});
export type MatchEnd = z.infer<typeof matchEndSchema>;

/** Payload-Typen je Socket.IO-Event – Basis für typisierte Clients und Server. */
export interface ClientToServerPayloads {
  'queue:join': QueueJoin;
  'queue:leave': QueueLeave;
  'code:run': CodeRun;
  'code:submit': CodeSubmit;
}

export interface ServerToClientPayloads {
  'match:found': MatchFound;
  'match:start': MatchStart;
  'run:result': RunResultEvent;
  'opponent:progress': OpponentProgress;
  'match:end': MatchEnd;
}

/** Formt eine Payload-Map in die Handler-Signaturen, die Socket.IO erwartet. */
export type SocketEventHandlers<T> = {
  [K in keyof T]: (payload: T[K]) => void;
};

/** Vollständige Event-Hülle (`type` + Payload) zum Validieren eingehender Nachrichten. */
export const clientEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('queue:join'), ...queueJoinSchema.shape }),
  z.object({ type: z.literal('queue:leave'), ...queueLeaveSchema.shape }),
  z.object({ type: z.literal('code:run'), ...codeRunSchema.shape }),
  z.object({ type: z.literal('code:submit'), ...codeSubmitSchema.shape }),
]);
export type ClientEvent = z.infer<typeof clientEventSchema>;

export const serverEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('match:found'), ...matchFoundSchema.shape }),
  z.object({ type: z.literal('match:start'), ...matchStartSchema.shape }),
  z.object({ type: z.literal('run:result'), ...runResultSchema.shape }),
  z.object({ type: z.literal('opponent:progress'), ...opponentProgressSchema.shape }),
  z.object({ type: z.literal('match:end'), ...matchEndSchema.shape }),
]);
export type ServerEvent = z.infer<typeof serverEventSchema>;
