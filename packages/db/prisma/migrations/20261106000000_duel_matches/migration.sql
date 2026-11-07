-- CreateEnum
CREATE TYPE "Language" AS ENUM ('javascript', 'python');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('WAITING', 'RUNNING', 'FINISHED', 'ABORTED');

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "kataSlug" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'WAITING',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "winnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eloBefore" INTEGER NOT NULL,
    "eloAfter" INTEGER,
    "testsPassed" INTEGER NOT NULL DEFAULT 0,
    "finalCode" TEXT,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Match_status_createdAt_idx" ON "Match"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Match_winnerId_idx" ON "Match"("winnerId");

-- CreateIndex
CREATE INDEX "MatchPlayer_userId_idx" ON "MatchPlayer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayer_matchId_userId_key" ON "MatchPlayer"("matchId", "userId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
