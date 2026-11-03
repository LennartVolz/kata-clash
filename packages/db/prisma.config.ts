import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Prisma wird aus packages/db gestartet; die Projekt-.env liegt im Repo-Root.
config({ path: '../../.env' });
config();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
