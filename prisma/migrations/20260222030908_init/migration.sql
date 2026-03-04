-- CreateEnum
CREATE TYPE "public"."Position" AS ENUM ('C', 'LW', 'RW', 'D', 'G');

-- CreateEnum
CREATE TYPE "public"."ContractStructure" AS ENUM ('FRONT_LOADED', 'BACK_LOADED', 'EVEN', 'FLAT');

-- CreateEnum
CREATE TYPE "public"."SigningType" AS ENUM ('RFA', 'UFA', 'ELC', 'EXTENSION');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'ANALYST', 'SCOUT', 'GM', 'VIEWER');

-- CreateEnum
CREATE TYPE "public"."ReportType" AS ENUM ('PLAYER_EVAL', 'TRADE_ANALYSIS', 'CONTRACT_PROJECTION', 'COMPARISON', 'CUSTOM');

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'VIEWER',
    "teamAffiliationId" TEXT,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Team" (
    "id" TEXT NOT NULL,
    "nhlApiId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "conference" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Player" (
    "id" TEXT NOT NULL,
    "nhlApiId" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "position" "public"."Position" NOT NULL,
    "shootsCatches" TEXT,
    "birthDate" TIMESTAMP(3),
    "birthCity" TEXT,
    "birthCountry" TEXT,
    "heightInches" INTEGER,
    "weightLbs" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "headshotUrl" TEXT,
    "currentTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Contract" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "startYear" INTEGER NOT NULL,
    "endYear" INTEGER NOT NULL,
    "totalYears" INTEGER NOT NULL,
    "aav" DECIMAL(12,2) NOT NULL,
    "totalValue" DECIMAL(12,2) NOT NULL,
    "structure" "public"."ContractStructure" NOT NULL DEFAULT 'EVEN',
    "capHitByYear" JSONB NOT NULL,
    "signingAge" INTEGER,
    "hasNTC" BOOLEAN NOT NULL DEFAULT false,
    "hasNMC" BOOLEAN NOT NULL DEFAULT false,
    "tradeProtectionDetails" TEXT,
    "signingType" "public"."SigningType",
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SeasonStats" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "teamId" TEXT,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "plusMinus" INTEGER NOT NULL DEFAULT 0,
    "pim" INTEGER NOT NULL DEFAULT 0,
    "toiPerGame" DECIMAL(6,2),
    "shots" INTEGER NOT NULL DEFAULT 0,
    "shootingPct" DECIMAL(5,2),
    "hits" INTEGER NOT NULL DEFAULT 0,
    "blocks" INTEGER NOT NULL DEFAULT 0,
    "takeaways" INTEGER NOT NULL DEFAULT 0,
    "giveaways" INTEGER NOT NULL DEFAULT 0,
    "faceoffPct" DECIMAL(5,2),
    "gameWinningGoals" INTEGER NOT NULL DEFAULT 0,
    "overtimeGoals" INTEGER NOT NULL DEFAULT 0,
    "powerPlayGoals" INTEGER NOT NULL DEFAULT 0,
    "powerPlayAssists" INTEGER NOT NULL DEFAULT 0,
    "powerPlayPoints" INTEGER NOT NULL DEFAULT 0,
    "powerPlayToi" DECIMAL(6,2),
    "shortHandedGoals" INTEGER NOT NULL DEFAULT 0,
    "shortHandedAssists" INTEGER NOT NULL DEFAULT 0,
    "shortHandedPoints" INTEGER NOT NULL DEFAULT 0,
    "shortHandedToi" DECIMAL(6,2),
    "evenStrengthGoals" INTEGER NOT NULL DEFAULT 0,
    "evenStrengthAssists" INTEGER NOT NULL DEFAULT 0,
    "evenStrengthPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SeasonStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdvancedStats" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "teamId" TEXT,
    "corsiFor" DECIMAL(8,2),
    "corsiAgainst" DECIMAL(8,2),
    "corsiForPct" DECIMAL(5,2),
    "fenwickForPct" DECIMAL(5,2),
    "expectedGoalsFor" DECIMAL(8,4),
    "expectedGoalsAgainst" DECIMAL(8,4),
    "xGFPct" DECIMAL(5,2),
    "goalsForPct" DECIMAL(5,2),
    "offensiveZoneStartPct" DECIMAL(5,2),
    "defensiveZoneStartPct" DECIMAL(5,2),
    "individualExpectedGoals" DECIMAL(8,4),
    "individualHighDangerChances" INTEGER,
    "onIceShootingPct" DECIMAL(5,2),
    "onIceSavePct" DECIMAL(5,3),
    "pdo" DECIMAL(6,3),
    "relCorsiForPct" DECIMAL(6,2),
    "relXGFPct" DECIMAL(6,2),

    CONSTRAINT "AdvancedStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlayerValueScore" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "scoringComponent" DECIMAL(5,2),
    "fiveOnFiveComponent" DECIMAL(5,2),
    "specialTeamsComponent" DECIMAL(5,2),
    "durabilityComponent" DECIMAL(5,2),
    "efficiencyComponent" DECIMAL(5,2),
    "warPerMillionComponent" DECIMAL(5,2),
    "costPerPoint" DECIMAL(12,2),
    "costPerGoal" DECIMAL(12,2),
    "costPerWAR" DECIMAL(12,2),
    "peerRank" INTEGER,
    "leagueRank" INTEGER,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerValueScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GoalieStats" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "teamId" TEXT,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "gamesStarted" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "otLosses" INTEGER NOT NULL DEFAULT 0,
    "savePercentage" DECIMAL(5,4),
    "goalsAgainstAvg" DECIMAL(5,3),
    "shotsAgainst" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "shutouts" INTEGER NOT NULL DEFAULT 0,
    "qualityStarts" INTEGER,
    "qualityStartPct" DECIMAL(5,2),
    "goalsAboveExpected" DECIMAL(8,4),
    "highDangerSavePct" DECIMAL(5,4),
    "mediumDangerSavePct" DECIMAL(5,4),
    "lowDangerSavePct" DECIMAL(5,4),

    CONSTRAINT "GoalieStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SavedReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "public"."ReportType" NOT NULL,
    "configuration" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TradeScenario" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "teams" JSONB NOT NULL,
    "playersInvolved" JSONB NOT NULL,
    "draftPicks" JSONB NOT NULL,
    "capImpact" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeScenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "public"."User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Team_nhlApiId_key" ON "public"."Team"("nhlApiId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_abbreviation_key" ON "public"."Team"("abbreviation");

-- CreateIndex
CREATE UNIQUE INDEX "Player_nhlApiId_key" ON "public"."Player"("nhlApiId");

-- CreateIndex
CREATE INDEX "Player_lastName_firstName_idx" ON "public"."Player"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Player_position_idx" ON "public"."Player"("position");

-- CreateIndex
CREATE INDEX "Player_currentTeamId_idx" ON "public"."Player"("currentTeamId");

-- CreateIndex
CREATE INDEX "Player_isActive_idx" ON "public"."Player"("isActive");

-- CreateIndex
CREATE INDEX "Contract_playerId_idx" ON "public"."Contract"("playerId");

-- CreateIndex
CREATE INDEX "Contract_teamId_idx" ON "public"."Contract"("teamId");

-- CreateIndex
CREATE INDEX "Contract_startYear_endYear_idx" ON "public"."Contract"("startYear", "endYear");

-- CreateIndex
CREATE INDEX "Contract_aav_idx" ON "public"."Contract"("aav");

-- CreateIndex
CREATE INDEX "Contract_signingType_idx" ON "public"."Contract"("signingType");

-- CreateIndex
CREATE INDEX "SeasonStats_season_idx" ON "public"."SeasonStats"("season");

-- CreateIndex
CREATE INDEX "SeasonStats_teamId_idx" ON "public"."SeasonStats"("teamId");

-- CreateIndex
CREATE INDEX "SeasonStats_points_idx" ON "public"."SeasonStats"("points");

-- CreateIndex
CREATE INDEX "SeasonStats_goals_idx" ON "public"."SeasonStats"("goals");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonStats_playerId_season_key" ON "public"."SeasonStats"("playerId", "season");

-- CreateIndex
CREATE INDEX "AdvancedStats_season_idx" ON "public"."AdvancedStats"("season");

-- CreateIndex
CREATE INDEX "AdvancedStats_teamId_idx" ON "public"."AdvancedStats"("teamId");

-- CreateIndex
CREATE INDEX "AdvancedStats_corsiForPct_idx" ON "public"."AdvancedStats"("corsiForPct");

-- CreateIndex
CREATE INDEX "AdvancedStats_xGFPct_idx" ON "public"."AdvancedStats"("xGFPct");

-- CreateIndex
CREATE UNIQUE INDEX "AdvancedStats_playerId_season_key" ON "public"."AdvancedStats"("playerId", "season");

-- CreateIndex
CREATE INDEX "PlayerValueScore_season_idx" ON "public"."PlayerValueScore"("season");

-- CreateIndex
CREATE INDEX "PlayerValueScore_overallScore_idx" ON "public"."PlayerValueScore"("overallScore");

-- CreateIndex
CREATE INDEX "PlayerValueScore_leagueRank_idx" ON "public"."PlayerValueScore"("leagueRank");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerValueScore_playerId_season_key" ON "public"."PlayerValueScore"("playerId", "season");

-- CreateIndex
CREATE INDEX "GoalieStats_season_idx" ON "public"."GoalieStats"("season");

-- CreateIndex
CREATE INDEX "GoalieStats_teamId_idx" ON "public"."GoalieStats"("teamId");

-- CreateIndex
CREATE INDEX "GoalieStats_savePercentage_idx" ON "public"."GoalieStats"("savePercentage");

-- CreateIndex
CREATE UNIQUE INDEX "GoalieStats_playerId_season_key" ON "public"."GoalieStats"("playerId", "season");

-- CreateIndex
CREATE INDEX "SavedReport_userId_idx" ON "public"."SavedReport"("userId");

-- CreateIndex
CREATE INDEX "SavedReport_type_idx" ON "public"."SavedReport"("type");

-- CreateIndex
CREATE INDEX "TradeScenario_userId_idx" ON "public"."TradeScenario"("userId");

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_teamAffiliationId_fkey" FOREIGN KEY ("teamAffiliationId") REFERENCES "public"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Player" ADD CONSTRAINT "Player_currentTeamId_fkey" FOREIGN KEY ("currentTeamId") REFERENCES "public"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contract" ADD CONSTRAINT "Contract_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contract" ADD CONSTRAINT "Contract_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeasonStats" ADD CONSTRAINT "SeasonStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SeasonStats" ADD CONSTRAINT "SeasonStats_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdvancedStats" ADD CONSTRAINT "AdvancedStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdvancedStats" ADD CONSTRAINT "AdvancedStats_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayerValueScore" ADD CONSTRAINT "PlayerValueScore_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GoalieStats" ADD CONSTRAINT "GoalieStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GoalieStats" ADD CONSTRAINT "GoalieStats_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SavedReport" ADD CONSTRAINT "SavedReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TradeScenario" ADD CONSTRAINT "TradeScenario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
