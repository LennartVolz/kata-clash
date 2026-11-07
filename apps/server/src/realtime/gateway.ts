import type { Server as HttpServer } from 'node:http';

import {
  codeRunSchema,
  codeSubmitSchema,
  queueJoinSchema,
  queueLeaveSchema,
  type ClientToServerPayloads,
  type ServerToClientPayloads,
  type SocketEventHandlers,
} from '@kata-clash/shared';
import { Server, type DefaultEventsMap } from 'socket.io';

import type { RunJobFn } from '../runner';
import type { SessionResolver } from './auth';
import {
  MatchManager,
  systemScheduler,
  type MatchScheduler,
  type RealtimeTransport,
} from './match-manager';
import { Matchmaker, type MatchmakingQueue, type PairingOptions } from './matchmaking';
import type { MatchStore, MatchUser } from './match-store';

interface SocketData {
  user: MatchUser;
}

type ClientEvents = SocketEventHandlers<ClientToServerPayloads>;
type ServerEvents = SocketEventHandlers<ServerToClientPayloads>;
type TypedServer = Server<ClientEvents, ServerEvents, DefaultEventsMap, SocketData>;

export interface RealtimeGatewayOptions {
  httpServer: HttpServer;
  store: MatchStore;
  queue: MatchmakingQueue;
  resolveSession: SessionResolver;
  runJob: RunJobFn;
  webOrigin: string;
  countdownMs: number;
  pairing: PairingOptions;
  scheduler?: MatchScheduler;
  log?: (message: string, error?: unknown) => void;
}

export interface RealtimeGateway {
  io: TypedServer;
  manager: MatchManager;
  matchmaker: Matchmaker;
  close(): Promise<void>;
}

function matchRoom(matchId: string): string {
  return `match:${matchId}`;
}

interface Emitter {
  emit(event: string, payload: unknown): void;
}

/**
 * Socket.IO typisiert `emit` über die Event-Map stark; hier wird bewusst über
 * eine schmale Sicht emittiert, damit die generischen Transport-Methoden passen.
 */
function emitTo(operator: unknown, event: string, payload: unknown): void {
  (operator as Emitter).emit(event, payload);
}

/** Verteilt Events an alle Sockets eines Nutzers bzw. an einen Match-Room. */
class SocketTransport implements RealtimeTransport {
  private readonly socketsByUser = new Map<string, Set<string>>();

  constructor(private readonly io: TypedServer) {}

  register(userId: string, socketId: string): void {
    const sockets = this.socketsByUser.get(userId) ?? new Set<string>();
    sockets.add(socketId);
    this.socketsByUser.set(userId, sockets);
  }

  unregister(userId: string, socketId: string): void {
    const sockets = this.socketsByUser.get(userId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) this.socketsByUser.delete(userId);
  }

  count(userId: string): number {
    return this.socketsByUser.get(userId)?.size ?? 0;
  }

  joinMatchRoom(userId: string, matchId: string): void {
    for (const socketId of this.socketsByUser.get(userId) ?? []) {
      this.io.sockets.sockets.get(socketId)?.join(matchRoom(matchId));
    }
  }

  emitToUser<K extends keyof ServerToClientPayloads>(
    userId: string,
    event: K,
    payload: ServerToClientPayloads[K],
  ): void {
    for (const socketId of this.socketsByUser.get(userId) ?? []) {
      emitTo(this.io.to(socketId), event, payload);
    }
  }

  emitToMatch<K extends keyof ServerToClientPayloads>(
    matchId: string,
    event: K,
    payload: ServerToClientPayloads[K],
  ): void {
    emitTo(this.io.to(matchRoom(matchId)), event, payload);
  }

  emitToOthers<K extends keyof ServerToClientPayloads>(
    matchId: string,
    exceptUserId: string,
    event: K,
    payload: ServerToClientPayloads[K],
  ): void {
    const except = [...(this.socketsByUser.get(exceptUserId) ?? [])];
    emitTo(this.io.to(matchRoom(matchId)).except(except), event, payload);
  }
}

/**
 * Baut das Socket.IO-Gateway an den bestehenden HTTP-Server: Auth-Handshake,
 * Queue-Events sowie Run/Submit. Alle Payloads werden gegen die Zod-Schemas
 * aus `@kata-clash/shared` geprüft.
 */
export function attachRealtimeGateway(options: RealtimeGatewayOptions): RealtimeGateway {
  const { httpServer, store, queue, resolveSession, runJob, log } = options;

  const io: TypedServer = new Server(httpServer, {
    cors: { origin: options.webOrigin, credentials: true },
    // Kurze Verbindungsabbrüche überstehen Rooms und verpasste Events (max. 2 Minuten).
    connectionStateRecovery: {},
  });
  const transport = new SocketTransport(io);
  const manager = new MatchManager({
    store,
    transport,
    runJob,
    countdownMs: options.countdownMs,
    scheduler: options.scheduler ?? systemScheduler,
    log,
  });
  const matchmaker = new Matchmaker({ queue, manager, ...options.pairing, log });

  const runSafely = (task: () => Promise<void>, message: string): void => {
    void task().catch((error) => log?.(message, error));
  };

  io.use((socket, next) => {
    void (async () => {
      try {
        const session = await resolveSession(socket.handshake.headers.cookie);
        if (!session) {
          next(new Error('unauthorized'));
          return;
        }
        const user = await store.findUser(session.id);
        if (!user) {
          next(new Error('unauthorized'));
          return;
        }
        socket.data.user = user;
        next();
      } catch (error) {
        log?.('Auth-Handshake fehlgeschlagen', error);
        next(new Error('unauthorized'));
      }
    })();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    transport.register(user.id, socket.id);
    // Reconnect: laufendes Match wieder betreten und Stand erneut senden.
    manager.resume(user.id);

    socket.on('queue:join', (payload) => {
      runSafely(async () => {
        const parsed = queueJoinSchema.safeParse(payload);
        if (!parsed.success) return;
        if (manager.hasActiveMatch(user.id)) return;
        // Ein Spieler soll immer nur in einer Sprache warten.
        await queue.removeUser(user.id);
        await queue.join(parsed.data.language, { userId: user.id, elo: user.elo });
        await matchmaker.tick();
      }, 'queue:join fehlgeschlagen');
    });

    socket.on('queue:leave', (payload) => {
      runSafely(async () => {
        const parsed = queueLeaveSchema.safeParse(payload);
        if (!parsed.success) return;
        await queue.leave(parsed.data.language, user.id);
      }, 'queue:leave fehlgeschlagen');
    });

    socket.on('code:run', (payload) => {
      runSafely(async () => {
        const parsed = codeRunSchema.safeParse(payload);
        if (!parsed.success) return;
        await manager.run(user.id, parsed.data.matchId, parsed.data.code);
      }, 'code:run fehlgeschlagen');
    });

    socket.on('code:submit', (payload) => {
      runSafely(async () => {
        const parsed = codeSubmitSchema.safeParse(payload);
        if (!parsed.success) return;
        await manager.submit(user.id, parsed.data.matchId, parsed.data.code);
      }, 'code:submit fehlgeschlagen');
    });

    socket.on('disconnect', () => {
      transport.unregister(user.id, socket.id);
      if (transport.count(user.id) > 0) return;
      // Ohne offenen Tab bringt Warten nichts mehr; das Match selbst läuft weiter.
      runSafely(() => queue.removeUser(user.id), 'Queue-Austritt fehlgeschlagen');
    });
  });

  return {
    io,
    manager,
    matchmaker,
    close: async () => {
      await io.close();
    },
  };
}
