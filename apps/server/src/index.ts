import './env';

import { buildApp } from './app';
import { loadRealtimeConfig } from './realtime/config';
import { startRealtime, type RealtimeHandle } from './realtime/start';
import { runJobInSandbox } from './runner';

const port = Number(process.env.SERVER_PORT ?? 4000);
const app = buildApp();

try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

const config = loadRealtimeConfig();
let realtime: RealtimeHandle | null = null;

if (!config) {
  app.log.warn('Echtzeit deaktiviert: AUTH_SECRET und REDIS_URL müssen gesetzt sein.');
} else {
  try {
    realtime = await startRealtime({
      httpServer: app.server,
      config,
      runJob: runJobInSandbox,
      log: (message, error) => app.log.error({ err: error }, message),
    });
    app.log.info('Echtzeit-Gateway bereit (Socket.IO + Redis-Matchmaking).');
  } catch (error) {
    app.log.error({ err: error }, 'Echtzeit-Gateway nicht gestartet; REST läuft weiter.');
  }
}

async function shutdown(signal: string): Promise<void> {
  app.log.info(`${signal} empfangen, fahre herunter …`);
  await realtime?.close();
  await app.close();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
