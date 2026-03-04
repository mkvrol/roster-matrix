-- CreateTable
CREATE TABLE "public"."PlayerImpactStats" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "teamWinPctWithPlayer" DECIMAL(5,3),
    "teamWinPctWithout" DECIMAL(5,3),
    "winPctDifferential" DECIMAL(6,3),
    "teamWinPctWhenScoring" DECIMAL(5,3),
    "teamWinPctWhenGettingPoint" DECIMAL(5,3),
    "teamWinPctWhenMultiPoint" DECIMAL(5,3),
    "teamRecordWithPlayer" TEXT,
    "teamRecordWithout" TEXT,
    "pointsPerGameInWins" DECIMAL(5,3),
    "goalsPerGameInWins" DECIMAL(5,3),
    "gameScore" DECIMAL(6,2),
    "highImpactGames" INTEGER NOT NULL DEFAULT 0,
    "clutchRating" DECIMAL(5,2),
    "onIceGoalsForPer60" DECIMAL(6,2),
    "onIceGoalsAgainstPer60" DECIMAL(6,2),
    "onIceShootingPct" DECIMAL(5,2),
    "onIceSavePct" DECIMAL(5,3),
    "pdo" DECIMAL(6,3),

    CONSTRAINT "PlayerImpactStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerImpactStats_season_idx" ON "public"."PlayerImpactStats"("season");

-- CreateIndex
CREATE INDEX "PlayerImpactStats_winPctDifferential_idx" ON "public"."PlayerImpactStats"("winPctDifferential");

-- CreateIndex
CREATE INDEX "PlayerImpactStats_clutchRating_idx" ON "public"."PlayerImpactStats"("clutchRating");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerImpactStats_playerId_season_key" ON "public"."PlayerImpactStats"("playerId", "season");

-- AddForeignKey
ALTER TABLE "public"."PlayerImpactStats" ADD CONSTRAINT "PlayerImpactStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
