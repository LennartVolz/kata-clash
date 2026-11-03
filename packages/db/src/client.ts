import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client';

/**
 * Prisma 7 verbindet sich über einen Treiber-Adapter. Der Client wird bewusst
 * erst beim ersten Zugriff erzeugt, damit `next build` ohne laufende Datenbank
 * funktioniert.
 */
function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL ?? '';
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Im Dev-Modus lädt Next Module neu; ohne Singleton sammeln sich Verbindungen an.
const globalForPrisma = globalThis as unknown as { kataPrisma?: PrismaClient };

export const prisma = globalForPrisma.kataPrisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.kataPrisma = prisma;
}
