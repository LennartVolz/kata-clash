import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma wird aus packages/db gestartet; die Projekt-.env liegt im Repo-Root.
config({ path: '../../.env' });
config();

// `generate` und `validate` brauchen keine Datenbank. Ohne DATABASE_URL bleibt die
// Datenquelle unkonfiguriert; nur `migrate`/`db`-Befehle schlagen dann fehl.
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
