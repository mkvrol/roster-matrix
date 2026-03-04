-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('SCORE_CHANGE', 'TRADE_ALERT', 'CONTRACT_UPDATE', 'GAME_UPDATE', 'SYSTEM');

-- DropIndex
DROP INDEX "public"."PlayerValueScore_playerId_season_key";

-- DropIndex
DROP INDEX "public"."PlayerValueScore_season_idx";

-- AlterTable
ALTER TABLE "public"."PlayerValueScore" ADD COLUMN     "aavTier" TEXT,
ADD COLUMN     "ageCurveComponent" DECIMAL(5,2),
ADD COLUMN     "components" JSONB,
ADD COLUMN     "estimatedWAR" DECIMAL(6,2),
ADD COLUMN     "grade" TEXT,
ADD COLUMN     "positionGroup" TEXT;

-- CreateTable
CREATE TABLE "public"."WatchList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WatchListPlayer" (
    "id" TEXT NOT NULL,
    "watchListId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "scoreWhenAdded" INTEGER,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchListPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "playerId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WatchList_userId_idx" ON "public"."WatchList"("userId");

-- CreateIndex
CREATE INDEX "WatchListPlayer_playerId_idx" ON "public"."WatchListPlayer"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchListPlayer_watchListId_playerId_key" ON "public"."WatchListPlayer"("watchListId", "playerId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "public"."Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "public"."Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "public"."Notification"("type");

-- CreateIndex
CREATE INDEX "PlayerValueScore_playerId_season_calculatedAt_idx" ON "public"."PlayerValueScore"("playerId", "season", "calculatedAt");

-- CreateIndex
CREATE INDEX "PlayerValueScore_season_calculatedAt_idx" ON "public"."PlayerValueScore"("season", "calculatedAt");

-- CreateIndex
CREATE INDEX "PlayerValueScore_positionGroup_season_idx" ON "public"."PlayerValueScore"("positionGroup", "season");

-- CreateIndex
CREATE INDEX "PlayerValueScore_aavTier_season_idx" ON "public"."PlayerValueScore"("aavTier", "season");

-- AddForeignKey
ALTER TABLE "public"."WatchList" ADD CONSTRAINT "WatchList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WatchListPlayer" ADD CONSTRAINT "WatchListPlayer_watchListId_fkey" FOREIGN KEY ("watchListId") REFERENCES "public"."WatchList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WatchListPlayer" ADD CONSTRAINT "WatchListPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
