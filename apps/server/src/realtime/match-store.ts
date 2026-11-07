import { prisma } from '@kata-clash/db';
import type { Language } from '@kata-clash/shared';

/** Profil, das das Gateway für Matchmaking und Match-Ende braucht. */
export interface MatchUser {
  id: string;
  name: string | null;
  email: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface CreateMatchInput {
  kataSlug: string;
  language: Language;
  players: { userId: string; eloBefore: number }[];
}

export interface FinishPlayerInput {
  userId: string;
  eloAfter: number | null;
  testsPassed: number;
  finalCode: string | null;
  finishedAt: Date | null;
}

export interface FinishMatchInput {
  matchId: string;
  status: 'FINISHED' | 'ABORTED';
  winnerId: string | null;
  endedAt: Date;
  players: FinishPlayerInput[];
}

/** Persistenz des Match-Lebenszyklus; in Tests durch eine In-Memory-Variante ersetzt. */
export interface MatchStore {
  findUser(userId: string): Promise<MatchUser | null>;
  createMatch(input: CreateMatchInput): Promise<{ id: string }>;
  markRunning(matchId: string, startsAt: Date, endsAt: Date): Promise<void>;
  saveProgress(
    matchId: string,
    userId: string,
    testsPassed: number,
    finalCode: string,
  ): Promise<void>;
  finishMatch(input: FinishMatchInput): Promise<void>;
}

/** Prisma-Implementierung; schreibt Match, Teilnahmen und Elo in einer Transaktion. */
export function createPrismaMatchStore(): MatchStore {
  return {
    findUser(userId) {
      return prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          elo: true,
          wins: true,
          losses: true,
          draws: true,
        },
      });
    },

    async createMatch(input) {
      const match = await prisma.match.create({
        data: {
          kataSlug: input.kataSlug,
          language: input.language,
          status: 'WAITING',
          players: {
            create: input.players.map((player) => ({
              userId: player.userId,
              eloBefore: player.eloBefore,
            })),
          },
        },
        select: { id: true },
      });
      return match;
    },

    async markRunning(matchId, startsAt, endsAt) {
      await prisma.match.update({
        where: { id: matchId },
        data: { status: 'RUNNING', startsAt, endsAt },
      });
    },

    async saveProgress(matchId, userId, testsPassed, finalCode) {
      await prisma.matchPlayer.update({
        where: { matchId_userId: { matchId, userId } },
        data: { testsPassed, finalCode },
      });
    },

    async finishMatch(input) {
      await prisma.$transaction(async (tx) => {
        await tx.match.update({
          where: { id: input.matchId },
          data: { status: input.status, winnerId: input.winnerId, endedAt: input.endedAt },
        });

        for (const player of input.players) {
          await tx.matchPlayer.update({
            where: { matchId_userId: { matchId: input.matchId, userId: player.userId } },
            data: {
              eloAfter: player.eloAfter,
              testsPassed: player.testsPassed,
              finalCode: player.finalCode,
              finishedAt: player.finishedAt,
            },
          });

          if (input.status !== 'FINISHED' || player.eloAfter === null) continue;
          await tx.user.update({
            where: { id: player.userId },
            data: {
              elo: player.eloAfter,
              wins: input.winnerId === player.userId ? { increment: 1 } : undefined,
              losses:
                input.winnerId !== null && input.winnerId !== player.userId
                  ? { increment: 1 }
                  : undefined,
              draws: input.winnerId === null ? { increment: 1 } : undefined,
            },
          });
        }
      });
    },
  };
}
