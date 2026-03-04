-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('TRADE', 'SIGNING', 'WAIVER', 'RECALL');

-- CreateEnum
CREATE TYPE "public"."InjuryType" AS ENUM ('DAY_TO_DAY', 'IR', 'LTIR', 'OUT');

-- CreateTable
CREATE TABLE "public"."Transaction" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "type" "public"."TransactionType" NOT NULL,
    "description" TEXT NOT NULL,
    "playersInvolved" JSONB NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Injury" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "type" "public"."InjuryType" NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "expectedReturn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Injury_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DraftPick" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "originalTeamId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "condition" TEXT,

    CONSTRAINT "DraftPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transaction_teamId_idx" ON "public"."Transaction"("teamId");

-- CreateIndex
CREATE INDEX "Transaction_date_idx" ON "public"."Transaction"("date");

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "public"."Transaction"("type");

-- CreateIndex
CREATE INDEX "Injury_teamId_idx" ON "public"."Injury"("teamId");

-- CreateIndex
CREATE INDEX "Injury_playerId_idx" ON "public"."Injury"("playerId");

-- CreateIndex
CREATE INDEX "Injury_type_idx" ON "public"."Injury"("type");

-- CreateIndex
CREATE INDEX "DraftPick_teamId_idx" ON "public"."DraftPick"("teamId");

-- CreateIndex
CREATE INDEX "DraftPick_year_idx" ON "public"."DraftPick"("year");

-- CreateIndex
CREATE UNIQUE INDEX "DraftPick_originalTeamId_year_round_key" ON "public"."DraftPick"("originalTeamId", "year", "round");

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Injury" ADD CONSTRAINT "Injury_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Injury" ADD CONSTRAINT "Injury_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DraftPick" ADD CONSTRAINT "DraftPick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DraftPick" ADD CONSTRAINT "DraftPick_originalTeamId_fkey" FOREIGN KEY ("originalTeamId") REFERENCES "public"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
