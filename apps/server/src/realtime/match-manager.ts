import { calculateElo, type Score } from '@kata-clash/elo';
import { KATAS, toKataDetail } from '@kata-clash/katas';
import type {
  Kata,
  Language,
  MatchEnd,
  MatchEndReason,
  MatchFound,
  MatchStart,
  OpponentProgress,
  RunJob,
  RunResult,
  RunResultEvent,
  ServerToClientPayloads,
} from '@kata-clash/shared';

import type { RunJobFn } from '../runner';
import type { MatchStore, MatchUser } from './match-store';

/** Timer-Abstraktion, damit Tests den Countdown ohne echtes Warten durchspielen. */
export interface MatchScheduler {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const systemScheduler: MatchScheduler = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

export interface RealtimeTransport {
  joinMatchRoom(userId: string, matchId: string): void;
  emitToUser<K extends keyof ServerToClientPayloads>(
    userId: string,
    event: K,
    payload: ServerToClientPayloads[K],
  ): void;
  emitToMatch<K extends keyof ServerToClientPayloads>(
    matchId: string,
    event: K,
    payload: ServerToClientPayloads[K],
  ): void;
  emitToOthers<K extends keyof ServerToClientPayloads>(
    matchId: string,
    exceptUserId: string,
    event: K,
    payload: ServerToClientPayloads[K],
  ): void;
}

interface PlayerState {
  id: string;
  name: string;
  elo: number;
  matchesPlayed: number;
  testsPassed: number;
  finalCode: string | null;
  submittedAt: number | null;
}

interface ActiveMatch {
  id: string;
  kata: Kata;
  language: Language;
  startsAt: number;
  endsAt: number;
  status: 'waiting' | 'running' | 'finished';
  players: [PlayerState, PlayerState];
  startTimer: unknown;
  endTimer: unknown;
}

export interface MatchManagerOptions {
  store: MatchStore;
  transport: RealtimeTransport;
  runJob: RunJobFn;
  scheduler?: MatchScheduler;
  countdownMs?: number;
  pickKata?: () => Kata;
  log?: (message: string, error?: unknown) => void;
}

/** Begrenzt mitgeschickte Konsolenausgaben im Duell (Bytes, grob als Zeichen). */
const MAX_OUTPUT_CHARS = 4000;

/**
 * Serverseitig autoritativer Match-Lebenszyklus: Countdown, Zeitlimit, Bewertung
 * der Submits und Elo-Update. Zustand ist bewusst prozesslokal; Redis hält nur
 * die Warteschlange.
 */
export class MatchManager {
  private readonly store: MatchStore;
  private readonly transport: RealtimeTransport;
  private readonly runJob: RunJobFn;
  private readonly scheduler: MatchScheduler;
  private readonly countdownMs: number;
  private readonly pickKata: () => Kata;
  private readonly log: (message: string, error?: unknown) => void;

  private readonly matches = new Map<string, ActiveMatch>();
  private readonly matchByUser = new Map<string, string>();
  private readonly pending = new Set<string>();

  constructor(options: MatchManagerOptions) {
    this.store = options.store;
    this.transport = options.transport;
    this.runJob = options.runJob;
    this.scheduler = options.scheduler ?? systemScheduler;
    this.countdownMs = options.countdownMs ?? 3_000;
    this.pickKata = options.pickKata ?? pickRandomKata;
    this.log = options.log ?? (() => {});
  }

  hasActiveMatch(userId: string): boolean {
    return this.matchByUser.has(userId);
  }

  /** Legt ein Match an, betritt die Rooms und startet den Countdown. */
  async createMatch(input: {
    language: Language;
    players: { userId: string; elo: number }[];
  }): Promise<void> {
    if (input.players.length !== 2) throw new Error('Ein Duell braucht genau zwei Spieler');

    const profiles = await Promise.all(
      input.players.map((player) => this.store.findUser(player.userId)),
    );
    const [first, second] = profiles;
    if (!first || !second) throw new Error('Spielerprofil nicht gefunden');

    const kata = this.pickKata();
    const { id } = await this.store.createMatch({
      kataSlug: kata.slug,
      language: input.language,
      players: [
        { userId: first.id, eloBefore: first.elo },
        { userId: second.id, eloBefore: second.elo },
      ],
    });

    const startsAt = this.scheduler.now() + this.countdownMs;
    const match: ActiveMatch = {
      id,
      kata,
      language: input.language,
      startsAt,
      endsAt: 0,
      status: 'waiting',
      players: [toPlayerState(first), toPlayerState(second)],
      startTimer: null,
      endTimer: null,
    };

    this.matches.set(id, match);
    for (const player of match.players) this.matchByUser.set(player.id, id);

    // Erst den Room betreten, dann benachrichtigen – sonst geht match:found verloren.
    for (const player of match.players) this.transport.joinMatchRoom(player.id, id);
    match.players.forEach((player, index) => {
      const opponent = match.players[1 - index] ?? player;
      const payload: MatchFound = {
        matchId: id,
        opponent: { id: opponent.id, name: opponent.name, elo: opponent.elo },
        startsAt,
      };
      this.transport.emitToUser(player.id, 'match:found', payload);
    });

    this.scheduleStart(match);
  }

  /** Für Reconnects: Raum betreten und den aktuellen Stand erneut senden. */
  resume(userId: string): void {
    const matchId = this.matchByUser.get(userId);
    const match = matchId ? this.matches.get(matchId) : undefined;
    if (!match) return;

    this.transport.joinMatchRoom(userId, match.id);
    if (match.status === 'waiting') {
      const opponent = match.players.find((player) => player.id !== userId) ?? match.players[0];
      this.transport.emitToUser(userId, 'match:found', {
        matchId: match.id,
        opponent: { id: opponent.id, name: opponent.name, elo: opponent.elo },
        startsAt: match.startsAt,
      });
      return;
    }

    if (match.status === 'running') {
      this.transport.emitToUser(userId, 'match:start', this.startPayload(match));
    }
  }

  /** Führt die sichtbaren Tests aus, ohne das Match zu beenden. */
  async run(userId: string, matchId: string, code: string): Promise<void> {
    await this.execute(userId, matchId, code, 'run');
  }

  /** Führt alle Tests aus und beendet das Match bei voller Punktzahl. */
  async submit(userId: string, matchId: string, code: string): Promise<void> {
    await this.execute(userId, matchId, code, 'submit');
  }

  private async execute(
    userId: string,
    matchId: string,
    code: string,
    kind: 'run' | 'submit',
  ): Promise<void> {
    const match = this.matches.get(matchId);
    if (!match || match.status !== 'running') return;

    const player = match.players.find((candidate) => candidate.id === userId);
    if (!player) return;

    // Ein abgelaufenes Match darf kein später Submit mehr entscheiden.
    if (this.scheduler.now() >= match.endsAt) {
      await this.finishByTimeout(match);
      return;
    }
    if (this.pending.has(userId)) return;

    this.pending.add(userId);
    try {
      const tests =
        kind === 'run' ? match.kata.tests.filter((test) => !test.hidden) : match.kata.tests;
      const job: RunJob = {
        language: match.language,
        code,
        functionName: match.kata.functionName,
        tests,
        timeLimitMs: match.kata.timeLimitSec * 1000,
      };
      const result = await this.runJob(job);
      if (match.status !== 'running') return;

      this.transport.emitToUser(userId, 'run:result', this.toRunResult(matchId, kind, result));
      if (kind === 'submit') await this.applySubmit(match, player, code, result);
    } catch (error) {
      this.log('Runner-Fehler im Duell', error);
      this.transport.emitToUser(userId, 'run:result', {
        matchId,
        kind,
        status: 'error',
        passedTests: 0,
        totalTests: match.kata.tests.length,
        tests: [],
        durationMs: 0,
        output: '',
        error: 'Runner nicht erreichbar',
      });
    } finally {
      this.pending.delete(userId);
    }
  }

  private async applySubmit(
    match: ActiveMatch,
    player: PlayerState,
    code: string,
    result: RunResult,
  ): Promise<void> {
    player.testsPassed = Math.max(player.testsPassed, result.passedTests);
    player.finalCode = code;
    player.submittedAt = this.scheduler.now();

    try {
      await this.store.saveProgress(match.id, player.id, player.testsPassed, code);
    } catch (error) {
      this.log('Fortschritt konnte nicht gespeichert werden', error);
    }

    const progress: OpponentProgress = {
      matchId: match.id,
      testsPassed: player.testsPassed,
      totalTests: match.kata.tests.length,
    };
    this.transport.emitToOthers(match.id, player.id, 'opponent:progress', progress);

    if (result.totalTests > 0 && result.passedTests === result.totalTests) {
      await this.finish(match, player.id, 'solved');
    }
  }

  private scheduleStart(match: ActiveMatch): void {
    const delay = Math.max(0, match.startsAt - this.scheduler.now());
    match.startTimer = this.scheduler.setTimeout(() => void this.begin(match), delay);
  }

  private async begin(match: ActiveMatch): Promise<void> {
    if (match.status !== 'waiting') return;
    match.startTimer = null;
    match.status = 'running';
    match.endsAt = match.startsAt + match.kata.timeLimitSec * 1000;

    try {
      await this.store.markRunning(match.id, new Date(match.startsAt), new Date(match.endsAt));
    } catch (error) {
      this.log('Match konnte nicht gestartet werden', error);
    }

    this.transport.emitToMatch(match.id, 'match:start', this.startPayload(match));
    const delay = Math.max(0, match.endsAt - this.scheduler.now());
    match.endTimer = this.scheduler.setTimeout(() => void this.finishByTimeout(match), delay);
  }

  private async finishByTimeout(match: ActiveMatch): Promise<void> {
    if (match.status !== 'running') return;
    const [first, second] = match.players;
    const winnerId =
      first.testsPassed === second.testsPassed
        ? null
        : first.testsPassed > second.testsPassed
          ? first.id
          : second.id;
    await this.finish(match, winnerId, 'timeout');
  }

  private async finish(
    match: ActiveMatch,
    winnerId: string | null,
    reason: MatchEndReason,
  ): Promise<void> {
    if (match.status === 'finished') return;
    match.status = 'finished';
    this.clearTimers(match);

    const endedAt = this.scheduler.now();
    const [first, second] = match.players;
    const scoreFirst: Score = winnerId === null ? 0.5 : winnerId === first.id ? 1 : 0;
    const elo = calculateElo(
      { rating: first.elo, matchesPlayed: first.matchesPlayed },
      { rating: second.elo, matchesPlayed: second.matchesPlayed },
      scoreFirst,
    );
    const eloAfter = [elo.a, elo.b];

    try {
      await this.store.finishMatch({
        matchId: match.id,
        status: 'FINISHED',
        winnerId,
        endedAt: new Date(endedAt),
        players: match.players.map((player) => ({
          userId: player.id,
          eloAfter: eloAfter[match.players.indexOf(player)] ?? player.elo,
          testsPassed: player.testsPassed,
          finalCode: player.finalCode,
          finishedAt: player.submittedAt === null ? null : new Date(player.submittedAt),
        })),
      });
    } catch (error) {
      this.log('Match konnte nicht abgeschlossen werden', error);
    }

    this.matches.delete(match.id);
    for (const player of match.players) this.matchByUser.delete(player.id);

    match.players.forEach((player, index) => {
      const after = eloAfter[index] ?? player.elo;
      const payload: MatchEnd = {
        matchId: match.id,
        winnerId,
        reason,
        eloDelta: after - player.elo,
        endedAt,
      };
      this.transport.emitToUser(player.id, 'match:end', payload);
    });
  }

  private clearTimers(match: ActiveMatch): void {
    if (match.startTimer !== null) this.scheduler.clearTimeout(match.startTimer);
    if (match.endTimer !== null) this.scheduler.clearTimeout(match.endTimer);
    match.startTimer = null;
    match.endTimer = null;
  }

  private startPayload(match: ActiveMatch): MatchStart {
    return {
      matchId: match.id,
      kata: toKataDetail(match.kata),
      startsAt: match.startsAt,
      endsAt: match.endsAt,
    };
  }

  private toRunResult(matchId: string, kind: 'run' | 'submit', result: RunResult): RunResultEvent {
    return {
      matchId,
      kind,
      status: result.status,
      passedTests: result.passedTests,
      totalTests: result.totalTests,
      // Versteckte Tests erscheinen nur in den Summen, nie mit Name oder Erwartung.
      tests: result.tests.filter((test) => !test.hidden),
      durationMs: result.durationMs,
      output: result.stderr.slice(-MAX_OUTPUT_CHARS),
      ...(result.error === undefined ? {} : { error: result.error }),
    };
  }
}

function toPlayerState(profile: MatchUser): PlayerState {
  return {
    id: profile.id,
    name: profile.name ?? profile.email.split('@')[0] ?? 'Spieler',
    elo: profile.elo,
    matchesPlayed: profile.wins + profile.losses + profile.draws,
    testsPassed: 0,
    finalCode: null,
    submittedAt: null,
  };
}

function pickRandomKata(): Kata {
  const index = Math.floor(Math.random() * KATAS.length);
  return KATAS[index] ?? KATAS[0]!;
}
