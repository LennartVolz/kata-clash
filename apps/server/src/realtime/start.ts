import type { Server as HttpServer } from 'node:http';

import { createClient } from 'redis';

import type { RunJobFn } from '../runner';
import { createSessionResolver } from './auth';
import type { RealtimeConfig } from './config';
import { attachRealtimeGateway, type RealtimeGateway } from './gateway';
import { systemScheduler } from './match-manager';
import { RedisMatchmakingQueue } from './matchmaking';
import { createPrismaMatchStore } from './match-store';

export interface RealtimeHandle {
  gateway: RealtimeGateway;
  close(): Promise<void>;
}

/**
 * Verbindet Redis, Prisma-Store und Gateway. Schlägt die Redis-Verbindung fehl,
 * wirft die Funktion; der Aufrufer entscheidet, ob die REST-API trotzdem läuft.
 */
export async function startRealtime(options: {
  httpServer: HttpServer;
  config: RealtimeConfig;
  runJob: RunJobFn;
  log?: (message: string, error?: unknown) => void;
}): Promise<RealtimeHandle> {
  const { httpServer, config, runJob, log } = options;

  const client = createClient({
    url: config.redisUrl,
    socket: {
      connectTimeout: 5_000,
      // Nach drei Fehlversuchen aufgeben, damit der REST-Start nicht blockiert.
      reconnectStrategy: (retries) =>
        retries >= 3 ? new Error('Redis nicht erreichbar') : Math.min(200 * (retries + 1), 1_000),
    },
  });
  client.on('error', (error) => log?.('Redis-Fehler', error));
  try {
    await client.connect();
  } catch (error) {
    client.destroy();
    throw error;
  }

  const gateway = attachRealtimeGateway({
    httpServer,
    store: createPrismaMatchStore(),
    queue: new RedisMatchmakingQueue(client),
    resolveSession: createSessionResolver(config.authSecret),
    runJob,
    webOrigin: config.webOrigin,
    countdownMs: config.countdownMs,
    pairing: {
      eloRangeBase: config.eloRangeBase,
      eloRangeGrowthPerSec: config.eloRangeGrowthPerSec,
      eloRangeMax: config.eloRangeMax,
    },
    scheduler: systemScheduler,
    log,
  });

  const ticker = setInterval(() => void gateway.matchmaker.tick(), config.queueTickMs);
  ticker.unref();

  return {
    gateway,
    close: async () => {
      clearInterval(ticker);
      await gateway.close();
      try {
        await client.quit();
      } catch {
        client.destroy();
      }
    },
  };
}
