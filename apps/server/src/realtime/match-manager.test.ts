import { findKata } from '@kata-clash/katas';
import type {
  MatchEnd,
  MatchStart,
  RunJob,
  RunResult,
  RunResultEvent,
  ServerToClientPayloads,
} from '@kata-clash/shared';
import { describe, expect, it } from 'vitest';

import type { RunJobFn } from '../runner';
import { MatchManager, type MatchScheduler, type RealtimeTransport } from './match-manager';
import type { FinishMatchInput, MatchStore, MatchUser } from './match-store';

const kata = findKata('summe-bis-n')!;

const USERS: MatchUser[] = [
  { id: 'a', name: 'Alice', email: 'alice@example.com', elo: 1200, wins: 0, losses: 0, draws: 0 },
  { id: 'b', name: 'Bob', email: 'bob@example.com', elo: 1200, wins: 0, losses: 0, draws: 0 },
];

interface RecordedEvent {
  target: string;
  event: string;
  payload: unknown;
}

class FakeStore implements MatchStore {
  readonly finishes: FinishMatchInput[] = [];
  private counter = 0;

  constructor(private readonly users: MatchUser[] = USERS) {}

  async findUser(userId: string): Promise<MatchUser | null> {
    return this.users.find((user) => user.id === userId) ?? null;
  }

  async createMatch(): Promise<{ id: string }> {
    this.counter += 1;
    return { id: `match-${this.counter}` };
  }

  async markRunning(): Promise<void> {}

  async saveProgress(): Promise<void> {}

  async finishMatch(input: FinishMatchInput): Promise<void> {
    this.finishes.push(input);
  }
}

class FakeTransport implements RealtimeTransport {
  readonly events: RecordedEvent[] = [];

  joinMatchRoom(userId: string, matchId: string): void {
    this.events.push({ target: `room:${matchId}`, event: 'join', payload: userId });
  }

  emitToUser<K extends keyof ServerToClientPayloads>(
    userId: string,
    event: K,
    payload: ServerToClientPayloads[K],
  ): void {
    this.events.push({ target: userId, event, payload });
  }

  emitToMatch<K extends keyof ServerToClientPayloads>(
    matchId: string,
    event: K,
    payload: ServerToClientPayloads[K],
  ): void {
    this.events.push({ target: `match:${matchId}`, event, payload });
  }

  emitToOthers<K extends keyof ServerToClientPayloads>(
    matchId: string,
    exceptUserId: string,
    event: K,
    payload: ServerToClientPayloads[K],
  ): void {
    this.events.push({ target: `others:${matchId}:${exceptUserId}`, event, payload });
  }
}

function events<T>(transport: FakeTransport, name: string): (RecordedEvent & { payload: T })[] {
  return transport.events.filter((event) => event.event === name) as (RecordedEvent & {
    payload: T;
  })[];
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function createClock(start = 1_700_000_000_000) {
  let now = start;
  let nextHandle = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();

  const scheduler: MatchScheduler = {
    now: () => now,
    setTimeout: (callback, delayMs) => {
      nextHandle += 1;
      timers.set(nextHandle, { at: now + delayMs, callback });
      return nextHandle;
    },
    clearTimeout: (handle) => {
      timers.delete(handle as number);
    },
  };

  async function advance(ms: number): Promise<void> {
    now += ms;
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.at <= now)
        .sort((first, second) => first[1].at - second[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      due[1].callback();
      await flush();
    }
  }

  return { scheduler, advance, now: () => now };
}

function allPassing(count: number): RunJobFn {
  return async (job: RunJob): Promise<RunResult> => ({
    status: 'passed',
    passedTests: count,
    totalTests: job.tests.length,
    tests: job.tests.map((test, index) => ({
      id: test.id,
      name: test.name,
      hidden: test.hidden,
      passed: index < count,
      durationMs: 1,
    })),
    durationMs: 5,
    exitCode: 0,
    stdout: '{}',
    stderr: '',
  });
}

function setup(runJob: RunJobFn) {
  const store = new FakeStore();
  const transport = new FakeTransport();
  const clock = createClock();
  const manager = new MatchManager({
    store,
    transport,
    runJob,
    scheduler: clock.scheduler,
    countdownMs: 3_000,
    pickKata: () => kata,
  });
  return { store, transport, clock, manager };
}

async function startMatch(manager: MatchManager, clock: ReturnType<typeof createClock>) {
  await manager.createMatch({
    language: 'javascript',
    players: [
      { userId: 'a', elo: 1200 },
      { userId: 'b', elo: 1200 },
    ],
  });
  await clock.advance(3_000);
}

describe('MatchManager', () => {
  it('sendet match:found an beide Spieler und startet nach dem Countdown', async () => {
    const { manager, transport, clock } = setup(allPassing(0));
    await manager.createMatch({
      language: 'javascript',
      players: [
        { userId: 'a', elo: 1200 },
        { userId: 'b', elo: 1200 },
      ],
    });

    const found = events<{ matchId: string; opponent: { id: string } }>(transport, 'match:found');
    expect(found).toHaveLength(2);
    expect(found.map((event) => event.target).sort()).toEqual(['a', 'b']);
    expect(found[0]!.payload.opponent.id).toBe('b');
    expect(events(transport, 'match:start')).toHaveLength(0);

    await clock.advance(3_000);
    const starts = events<MatchStart>(transport, 'match:start');
    expect(starts).toHaveLength(1);
    expect(starts[0]!.payload.kata.slug).toBe('summe-bis-n');
    expect(starts[0]!.payload.endsAt - starts[0]!.payload.startsAt).toBe(kata.timeLimitSec * 1000);
  });

  it('führt bei code:run nur sichtbare Tests aus und beendet nichts', async () => {
    const { manager, transport, clock } = setup(allPassing(2));
    await startMatch(manager, clock);

    await manager.run('a', 'match-1', 'function solve() {}');

    const results = events<RunResultEvent>(transport, 'run:result');
    expect(results).toHaveLength(1);
    expect(results[0]!.payload.kind).toBe('run');
    expect(results[0]!.payload.tests).toHaveLength(kata.tests.filter((t) => !t.hidden).length);
    expect(events(transport, 'match:end')).toHaveLength(0);
  });

  it('beendet das Match, sobald alle Tests grün sind, und vergibt Elo', async () => {
    const { manager, transport, store, clock } = setup(allPassing(4));
    await startMatch(manager, clock);

    await manager.submit('a', 'match-1', 'function solve() {}');

    expect(events(transport, 'opponent:progress')).toHaveLength(1);
    const ends = events<MatchEnd>(transport, 'match:end');
    expect(ends).toHaveLength(2);
    const forWinner = ends.find((event) => event.target === 'a')!.payload;
    const forLoser = ends.find((event) => event.target === 'b')!.payload;
    expect(forWinner).toMatchObject({ winnerId: 'a', reason: 'solved', eloDelta: 20 });
    expect(forLoser.eloDelta).toBe(-20);

    expect(store.finishes).toHaveLength(1);
    expect(store.finishes[0]!.winnerId).toBe('a');
    expect(store.finishes[0]!.players.find((player) => player.userId === 'a')?.eloAfter).toBe(1220);
  });

  it('kürt bei Zeitablauf den Spieler mit mehr bestandenen Tests', async () => {
    const { manager, transport, clock } = setup(allPassing(1));
    await startMatch(manager, clock);

    await manager.submit('a', 'match-1', 'function solve() {}');
    expect(events(transport, 'match:end')).toHaveLength(0);

    await clock.advance(kata.timeLimitSec * 1000);

    const ends = events<MatchEnd>(transport, 'match:end');
    expect(ends).toHaveLength(2);
    expect(ends[0]!.payload).toMatchObject({ winnerId: 'a', reason: 'timeout' });
  });

  it('wertet gleichen Fortschritt bei Zeitablauf als Remis', async () => {
    const { manager, transport, clock } = setup(allPassing(0));
    await startMatch(manager, clock);

    await clock.advance(kata.timeLimitSec * 1000);

    const ends = events<MatchEnd>(transport, 'match:end');
    expect(ends).toHaveLength(2);
    expect(ends[0]!.payload.winnerId).toBeNull();
    expect(ends[0]!.payload.eloDelta).toBe(0);
  });

  it('sendet nach einem Reconnect den laufenden Stand erneut', async () => {
    const { manager, transport, clock } = setup(allPassing(0));
    await startMatch(manager, clock);

    manager.resume('a');

    expect(events(transport, 'match:start').length).toBeGreaterThanOrEqual(2);
    expect(events(transport, 'match:end')).toHaveLength(0);
  });
});
