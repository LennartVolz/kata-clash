import { buildApp } from './app';

const port = Number(process.env.SERVER_PORT ?? 4000);
const app = buildApp();

try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
