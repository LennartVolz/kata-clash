import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { encode } from '@auth/core/jwt';
import { findKata } from '@kata-clash/katas';
import type { MatchEnd, MatchFound, MatchStart, RunJob, RunResult } from '@kata-clash/shared';
import { io as connectSocket, type Socket } from 'socket.io-client';
import { describe, expect, it } from 'vitest';

import type { RunJobFn } from '../runner';
import { createSessionResolver } from './auth';
import { attachRealtimeGateway } from './gateway';
import type { MatchScheduler } from './match-manager';
import { InMemoryMatchmakingQueue } from './matchmaking';
import type { MatchStore, MatchUser } from './match-store';

const SECRET = 'gateway-test-secret-mit-mindestens-32-zeichen';

const USERS: MatchUser[] = [
  { id: 'a', name: 'Alice', email: 'alice@example.com', elo: 1200, wins: 0, losses: 0, draws: 0 },
  { id: 'b', name: 'Bob', email: 'bob@example.com', elo: 1200, wins: 0, losses: 0, draws: 0 },
];

class GatewayStore implements MatchStore {
  private counter = 0;

  async findUser(userId: string): Promise<MatchUser | null> {
    return USERS.find((user) => user.id === userId) ?? null;
  }

  async createMatch(): Promise<{ id: string }> {
    this.counter += 1;
    return { id: `match-${this.counter}` };
  }

  async markRunning(): Promise<void> {}

  async saveProgress(): Promise<void> {}

  async finishMatch(): Promise<void> {}
}

const allPass: RunJobFn = async (job: RunJob): Promise<RunResult> => ({
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
  stdout: '{}',
  stderr: '',
});

function createClock() {
  let now = 1_700_000_000_000;
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
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return { scheduler, advance };
}

function waitForConnect(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve();
      return;
    }
    socket.once('connect', () => resolve());
    socket.once('connect_error', (error: Error) => reject(error));
  });
}

function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => {
    socket.once(event, (payload: T) => resolve(payload));
  });
}

async function sessionCookie(userId: string): Promise<string> {
  const token = await encode({
    token: { id: userId, sub: userId },
    secret: SECRET,
    salt: 'authjs.session-token',
  });
  return `authjs.session-token=${token}`;
}

describe('Socket.IO-Gateway', () => {
  it('authentifiziert per Session-Cookie, paart zwei Spieler und beendet das Match', async () => {
    const httpServer = createServer();
    const clock = createClock();
    const gateway = attachRealtimeGateway({
      httpServer,
      store: new GatewayStore(),
      queue: new InMemoryMatchmakingQueue(),
      resolveSession: createSessionResolver(SECRET),
      runJob: allPass,
      webOrigin: 'http://localhost:3000',
      countdownMs: 3_000,
      pairing: { eloRangeBase: 100, eloRangeGrowthPerSec: 50, eloRangeMax: 1000 },
      scheduler: clock.scheduler,
      log: () => {},
    });

    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const { port } = httpServer.address() as AddressInfo;
    const url = `http://127.0.0.1:${port}`;

    const clients: Socket[] = [];
    try {
      const alice = connectSocket(url, {
        transports: ['websocket'],
        extraHeaders: { cookie: await sessionCookie('a') },
        forceNew: true,
      });
      const bob = connectSocket(url, {
        transports: ['websocket'],
        extraHeaders: { cookie: await sessionCookie('b') },
        forceNew: true,
      });
      clients.push(alice, bob);
      await Promise.all([waitForConnect(alice), waitForConnect(bob)]);

      const foundAlice = once<MatchFound>(alice, 'match:found');
      const foundBob = once<MatchFound>(bob, 'match:found');
      alice.emit('queue:join', { language: 'javascript' });
      bob.emit('queue:join', { language: 'javascript' });

      const [matchForAlice, matchForBob] = await Promise.all([foundAlice, foundBob]);
      expect(matchForAlice.matchId).toBe(matchForBob.matchId);

      const startForAlice = once<MatchStart>(alice, 'match:start');
      const startForBob = once<MatchStart>(bob, 'match:start');
      await clock.advance(3_000);
      const [start] = await Promise.all([startForAlice, startForBob]);
      // Die Kata wird zufällig gewählt; sie muss aber aus der Bibliothek stammen.
      expect(findKata(start.kata.slug)?.slug).toBe(start.kata.slug);
      expect(start.kata.tests).toHaveLength(start.kata.visibleTests);

      const endForAlice = once<MatchEnd>(alice, 'match:end');
      const endForBob = once<MatchEnd>(bob, 'match:end');
      alice.emit('code:submit', {
        matchId: start.matchId,
        code: 'function solve(n) { return n; }',
      });

      const [endAlice, endBob] = await Promise.all([endForAlice, endForBob]);
      expect(endAlice).toMatchObject({ winnerId: 'a', reason: 'solved', eloDelta: 20 });
      expect(endBob.eloDelta).toBe(-20);
    } finally {
      for (const client of clients) client.close();
      await gateway.close();
      if (httpServer.listening) {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      }
    }
  }, 10_000);
});
