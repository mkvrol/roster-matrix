// ──────────────────────────────────────────────
// Roster Matrix — Player Detail Router
// Backend procedures for the player profile page
// ──────────────────────────────────────────────

import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { prisma } from "@/lib/prisma";
import { getLatestSeason } from "@/server/services/value-batch";
import {
  getPositionGroup,
  projectNextContract,
  findComparableContracts,
} from "@/lib/value-engine";
import type { Position, ValueInput } from "@/lib/value-engine";

const CURRENT_SEASON_START = 2025;
const CURRENT_SEASON_END = 2026;

// ── Helpers ──

function getAge(birthDate: Date | null): number {
  if (!birthDate) return 27;
  const now = new Date();
  let years = now.getFullYear() - birthDate.getFullYear();
  if (
    now.getMonth() < birthDate.getMonth() ||
    (now.getMonth() === birthDate.getMonth() &&
      now.getDate() < birthDate.getDate())
  ) {
    years--;
  }
  return years;
}

function buildPlayerValueInput(
  position: string,
  age: number,
  contract: {
    aav: unknown;
    totalYears: number;
    startYear: number;
    endYear: number;
    hasNTC: boolean;
    hasNMC: boolean;
    signingType: string | null;
    signingAge: number | null;
  },
  stats:
    | {
        gamesPlayed: number;
        goals: number;
        assists: number;
        points: number;
        plusMinus: number;
        pim: number;
        toiPerGame: unknown;
        shots: number;
        shootingPct: unknown;
        hits: number;
        blocks: number;
        takeaways: number;
        giveaways: number;
        faceoffPct: unknown;
        gameWinningGoals: number;
        overtimeGoals: number;
        powerPlayGoals: number;
        powerPlayAssists: number;
        powerPlayPoints: number;
        powerPlayToi: unknown;
        shortHandedGoals: number;
        shortHandedAssists: number;
        shortHandedPoints: number;
        shortHandedToi: unknown;
        evenStrengthGoals: number;
        evenStrengthAssists: number;
        evenStrengthPoints: number;
      }
    | undefined,
  goalie:
    | {
        gamesPlayed: number;
        gamesStarted: number;
        wins: number;
        losses: number;
        otLosses: number;
        savePercentage: unknown;
        goalsAgainstAvg: unknown;
        shotsAgainst: number;
        saves: number;
        shutouts: number;
        qualityStarts: number | null;
        qualityStartPct: unknown;
        goalsAboveExpected: unknown;
        highDangerSavePct: unknown;
      }
    | undefined,
  advanced:
    | {
        corsiForPct: unknown;
        xGFPct: unknown;
        goalsForPct: unknown;
        relCorsiForPct: unknown;
        relXGFPct: unknown;
        individualExpectedGoals: unknown;
        individualHighDangerChances: number | null;
        defensiveZoneStartPct: unknown;
        offensiveZoneStartPct: unknown;
        fiveOnFiveTOIPerGP: unknown;
        ppTOIPerGP: unknown;
        pkTOIPerGP: unknown;
        goalsPer60: unknown;
        pointsPer60: unknown;
        penaltyDifferential: number | null;
      }
    | undefined,
): ValueInput {
  const posGroup = getPositionGroup(position as Position);

  const input: ValueInput = {
    player: { position: position as Position, age },
    contract: {
      aav: Number(contract.aav),
      totalYears: contract.totalYears,
      startYear: contract.startYear,
      endYear: contract.endYear,
      hasNTC: contract.hasNTC,
      hasNMC: contract.hasNMC,
      signingType: contract.signingType ?? undefined,
      signingAge: contract.signingAge ?? undefined,
    },
  };

  if (posGroup === "G" && goalie) {
    input.goalie = {
      gamesPlayed: goalie.gamesPlayed,
      gamesStarted: goalie.gamesStarted,
      wins: goalie.wins,
      losses: goalie.losses,
      otLosses: goalie.otLosses,
      savePercentage: Number(goalie.savePercentage ?? 0.9),
      goalsAgainstAvg: Number(goalie.goalsAgainstAvg ?? 3.0),
      shotsAgainst: goalie.shotsAgainst,
      saves: goalie.saves,
      shutouts: goalie.shutouts,
      qualityStarts: goalie.qualityStarts ?? undefined,
      qualityStartPct: goalie.qualityStartPct
        ? Number(goalie.qualityStartPct)
        : undefined,
      goalsAboveExpected: goalie.goalsAboveExpected
        ? Number(goalie.goalsAboveExpected)
        : undefined,
      highDangerSavePct: goalie.highDangerSavePct
        ? Number(goalie.highDangerSavePct)
        : undefined,
    };
  } else if (stats) {
    input.stats = {
      gamesPlayed: stats.gamesPlayed,
      goals: stats.goals,
      assists: stats.assists,
      points: stats.points,
      plusMinus: stats.plusMinus,
      pim: stats.pim,
      toiPerGame: Number(stats.toiPerGame ?? 16),
      shots: stats.shots,
      shootingPct: Number(stats.shootingPct ?? 10),
      hits: stats.hits,
      blocks: stats.blocks,
      takeaways: stats.takeaways,
      giveaways: stats.giveaways,
      faceoffPct: stats.faceoffPct ? Number(stats.faceoffPct) : undefined,
      gameWinningGoals: stats.gameWinningGoals,
      overtimeGoals: stats.overtimeGoals,
      powerPlayGoals: stats.powerPlayGoals,
      powerPlayAssists: stats.powerPlayAssists,
      powerPlayPoints: stats.powerPlayPoints,
      powerPlayToi: stats.powerPlayToi
        ? Number(stats.powerPlayToi)
        : undefined,
      shortHandedGoals: stats.shortHandedGoals,
      shortHandedAssists: stats.shortHandedAssists,
      shortHandedPoints: stats.shortHandedPoints,
      shortHandedToi: stats.shortHandedToi
        ? Number(stats.shortHandedToi)
        : undefined,
      evenStrengthGoals: stats.evenStrengthGoals,
      evenStrengthAssists: stats.evenStrengthAssists,
      evenStrengthPoints: stats.evenStrengthPoints,
    };

    if (advanced) {
      input.advanced = {
        corsiForPct: advanced.corsiForPct
          ? Number(advanced.corsiForPct)
          : undefined,
        xGFPct: advanced.xGFPct ? Number(advanced.xGFPct) : undefined,
        goalsForPct: advanced.goalsForPct
          ? Number(advanced.goalsForPct)
          : undefined,
        relCorsiForPct: advanced.relCorsiForPct
          ? Number(advanced.relCorsiForPct)
          : undefined,
        individualExpectedGoals: advanced.individualExpectedGoals
          ? Number(advanced.individualExpectedGoals)
          : undefined,
        individualHighDangerChances:
          advanced.individualHighDangerChances ?? undefined,
        defensiveZoneStartPct: advanced.defensiveZoneStartPct
          ? Number(advanced.defensiveZoneStartPct)
          : undefined,
        offensiveZoneStartPct: advanced.offensiveZoneStartPct
          ? Number(advanced.offensiveZoneStartPct)
          : undefined,
        relXGFPct: advanced.relXGFPct
          ? Number(advanced.relXGFPct)
          : undefined,
        fiveOnFiveTOIPerGP: advanced.fiveOnFiveTOIPerGP
          ? Number(advanced.fiveOnFiveTOIPerGP)
          : undefined,
        ppTOIPerGP: advanced.ppTOIPerGP
          ? Number(advanced.ppTOIPerGP)
          : undefined,
        pkTOIPerGP: advanced.pkTOIPerGP
          ? Number(advanced.pkTOIPerGP)
          : undefined,
        goalsPer60: advanced.goalsPer60
          ? Number(advanced.goalsPer60)
          : undefined,
        pointsPer60: advanced.pointsPer60
          ? Number(advanced.pointsPer60)
          : undefined,
        penaltyDifferential: advanced.penaltyDifferential ?? undefined,
      };
    }
  }

  return input;
}

function generateGMNote(
  playerName: string,
  age: number,
  score: { overallScore: number; grade: string | null } | null,
  contractAav: number,
  contractEndYear: number,
  stats: { gamesPlayed: number; points: number } | null,
  projection: {
    projectedAAV: { low: number; mid: number; high: number };
    projectedTerm: { low: number; mid: number; high: number };
    confidence: number;
    comparables: unknown;
    factors: unknown;
  } | null,
): string {
  if (!score) {
    return `${playerName} does not have a calculated value score yet. Run a value calculation to generate insights.`;
  }

  const aavM = contractAav / 1_000_000;
  const yearsLeft = Math.max(0, contractEndYear - CURRENT_SEASON_END);

  let verb: string;
  if (score.overallScore >= 75) verb = "significantly outperforming";
  else if (score.overallScore >= 60) verb = "outperforming";
  else if (score.overallScore >= 45) verb = "producing at fair value for";
  else if (score.overallScore >= 30) verb = "underperforming";
  else verb = "significantly underperforming";

  let note = `${playerName} is ${verb} his $${aavM.toFixed(1)}M contract with a value score of ${score.overallScore} (${score.grade}).`;

  if (age <= 23)
    note += ` At ${age}, he is in the early stages of his career with significant upside potential.`;
  else if (age <= 27) note += ` At ${age}, he is entering or in his prime years.`;
  else if (age <= 30)
    note += ` At ${age}, he is in his peak earning window.`;
  else
    note += ` At ${age}, age-related decline is a factor in future projections.`;

  if (stats && stats.gamesPlayed > 0) {
    const ppg = (stats.points / stats.gamesPlayed).toFixed(2);
    note += ` He has ${stats.points} points in ${stats.gamesPlayed} games (${ppg} P/GP) this season.`;
  }

  if (yearsLeft <= 1)
    note += ` His contract expires this off-season, making him a key decision point.`;
  else if (yearsLeft === 2)
    note += ` With ${yearsLeft} years remaining, extension discussions should begin soon.`;
  else note += ` He has ${yearsLeft} years remaining on his current deal.`;

  if (projection) {
    const projAAV = projection.projectedAAV.mid / 1_000_000;
    note += ` His next contract is projected at $${projAAV.toFixed(1)}M × ${projection.projectedTerm.mid} years (${projection.confidence}% confidence).`;
    const raise = projAAV - aavM;
    if (raise > 2)
      note += ` This represents a significant raise of $${raise.toFixed(1)}M.`;
    else if (raise > 0) note += ` This represents a modest raise.`;
    else if (raise < -1)
      note += ` This suggests he may take a pay cut on his next deal.`;
  }

  return note;
}

async function getCostEfficiencyRanking(posGroup: string, season: string) {
  const scores = await prisma.playerValueScore.findMany({
    where: { season, positionGroup: posGroup },
    orderBy: { calculatedAt: "desc" },
    distinct: ["playerId"],
    include: {
      player: {
        select: {
          fullName: true,
          position: true,
          currentTeam: { select: { abbreviation: true } },
          contracts: {
            orderBy: { startYear: "desc" as const },
            take: 1,
            select: { aav: true },
          },
        },
      },
    },
  });

  return scores
    .filter((s) => s.player.contracts[0])
    .map((s) => ({
      playerId: s.playerId,
      playerName: s.player.fullName,
      position: s.player.position,
      teamAbbreviation: s.player.currentTeam?.abbreviation ?? null,
      overallScore: s.overallScore,
      aav: Number(s.player.contracts[0].aav),
      costPerWAR: s.costPerWAR ? Number(s.costPerWAR) : null,
    }))
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, 30);
}

// ── Router ──

export const playerRouter = router({
  // ── Full player profile ──
  getProfile: protectedProcedure
    .input(z.object({ playerId: z.string() }))
    .query(async ({ input }) => {
      const season = await getLatestSeason();

      const player = await prisma.player.findUniqueOrThrow({
        where: { id: input.playerId },
        include: {
          currentTeam: true,
          draftTeam: { select: { name: true, abbreviation: true } },
          contracts: {
            orderBy: { startYear: "desc" as const },
            take: 1,
          },
          seasonStats: {
            where: { season },
            take: 1,
          },
          goalieStats: {
            where: { season },
            take: 1,
          },
          impactStats: {
            orderBy: { season: "desc" as const },
            take: 1,
          },
          valueScores: {
            orderBy: { calculatedAt: "desc" as const },
            take: 1,
          },
        },
      });

      const careerImpact = await prisma.playerImpactStats.findMany({
        where: { playerId: input.playerId },
        select: {
          season: true,
          teamWinPctWithPlayer: true,
          teamWinPctWithout: true,
          winPctDifferential: true,
          clutchRating: true,
          highImpactGames: true,
          gameScore: true,
        },
      });

      const contract = player.contracts[0];
      const stats = player.seasonStats[0];
      const goalie = player.goalieStats?.[0];
      const score = player.valueScores[0];
      const age = getAge(player.birthDate);

      return {
        id: player.id,
        nhlApiId: player.nhlApiId,
        fullName: player.fullName,
        firstName: player.firstName,
        lastName: player.lastName,
        position: player.position,
        shootsCatches: player.shootsCatches,
        birthDate: player.birthDate,
        age,
        heightInches: player.heightInches,
        weightLbs: player.weightLbs,
        headshotUrl: player.headshotUrl,
        isActive: player.isActive,
        draftYear: player.draftYear,
        draftRound: player.draftRound,
        draftOverall: player.draftOverall,
        draftTeam: player.draftTeam
          ? { name: player.draftTeam.name, abbreviation: player.draftTeam.abbreviation }
          : null,
        team: player.currentTeam
          ? {
              id: player.currentTeam.id,
              name: player.currentTeam.name,
              abbreviation: player.currentTeam.abbreviation,
              logoUrl: player.currentTeam.logoUrl,
              primaryColor: player.currentTeam.primaryColor,
            }
          : null,
        contract: contract
          ? {
              aav: Number(contract.aav),
              totalValue: Number(contract.totalValue),
              totalYears: contract.totalYears,
              startYear: contract.startYear,
              endYear: contract.endYear,
              yearsRemaining: Math.max(
                0,
                contract.endYear - CURRENT_SEASON_END,
              ),
              structure: contract.structure,
              hasNTC: contract.hasNTC,
              hasNMC: contract.hasNMC,
              tradeProtectionDetails: contract.tradeProtectionDetails,
              signingType: contract.signingType,
              signingAge: contract.signingAge,
              capHitByYear: contract.capHitByYear as Record<string, number>,
            }
          : null,
        stats: stats
          ? {
              season,
              gamesPlayed: stats.gamesPlayed,
              goals: stats.goals,
              assists: stats.assists,
              points: stats.points,
              plusMinus: stats.plusMinus,
              pim: stats.pim,
              toiPerGame: Number(stats.toiPerGame ?? 0),
              shots: stats.shots,
              shootingPct: Number(stats.shootingPct ?? 0),
              hits: stats.hits,
              blocks: stats.blocks,
              takeaways: stats.takeaways,
              giveaways: stats.giveaways,
              faceoffPct: stats.faceoffPct ? Number(stats.faceoffPct) : null,
              gameWinningGoals: stats.gameWinningGoals,
              powerPlayGoals: stats.powerPlayGoals,
              powerPlayAssists: stats.powerPlayAssists,
              powerPlayPoints: stats.powerPlayPoints,
              powerPlayToi: stats.powerPlayToi
                ? Number(stats.powerPlayToi)
                : null,
              shortHandedGoals: stats.shortHandedGoals,
              shortHandedPoints: stats.shortHandedPoints,
              shortHandedToi: stats.shortHandedToi
                ? Number(stats.shortHandedToi)
                : null,
              evenStrengthGoals: stats.evenStrengthGoals,
              evenStrengthPoints: stats.evenStrengthPoints,
            }
          : null,
        goalieStats: goalie
          ? {
              gamesPlayed: goalie.gamesPlayed,
              gamesStarted: goalie.gamesStarted,
              wins: goalie.wins,
              losses: goalie.losses,
              otLosses: goalie.otLosses,
              savePercentage: Number(goalie.savePercentage ?? 0),
              goalsAgainstAvg: Number(goalie.goalsAgainstAvg ?? 0),
              shotsAgainst: goalie.shotsAgainst,
              saves: goalie.saves,
              shutouts: goalie.shutouts,
              qualityStarts: goalie.qualityStarts,
              qualityStartPct: goalie.qualityStartPct
                ? Number(goalie.qualityStartPct)
                : null,
              goalsAboveExpected: goalie.goalsAboveExpected
                ? Number(goalie.goalsAboveExpected)
                : null,
              highDangerSavePct: goalie.highDangerSavePct
                ? Number(goalie.highDangerSavePct)
                : null,
            }
          : null,
        impactStats: player.impactStats[0]
          ? {
              teamWinPctWithPlayer: player.impactStats[0].teamWinPctWithPlayer
                ? Number(player.impactStats[0].teamWinPctWithPlayer)
                : null,
              teamWinPctWithout: player.impactStats[0].teamWinPctWithout
                ? Number(player.impactStats[0].teamWinPctWithout)
                : null,
              winPctDifferential: player.impactStats[0].winPctDifferential
                ? Number(player.impactStats[0].winPctDifferential)
                : null,
              teamWinPctWhenScoring: player.impactStats[0].teamWinPctWhenScoring
                ? Number(player.impactStats[0].teamWinPctWhenScoring)
                : null,
              teamWinPctWhenGettingPoint: player.impactStats[0].teamWinPctWhenGettingPoint
                ? Number(player.impactStats[0].teamWinPctWhenGettingPoint)
                : null,
              teamWinPctWhenMultiPoint: player.impactStats[0].teamWinPctWhenMultiPoint
                ? Number(player.impactStats[0].teamWinPctWhenMultiPoint)
                : null,
              teamRecordWithPlayer: player.impactStats[0].teamRecordWithPlayer,
              teamRecordWithout: player.impactStats[0].teamRecordWithout,
              pointsPerGameInWins: player.impactStats[0].pointsPerGameInWins
                ? Number(player.impactStats[0].pointsPerGameInWins)
                : null,
              goalsPerGameInWins: player.impactStats[0].goalsPerGameInWins
                ? Number(player.impactStats[0].goalsPerGameInWins)
                : null,
              gameScore: player.impactStats[0].gameScore
                ? Number(player.impactStats[0].gameScore)
                : null,
              highImpactGames: player.impactStats[0].highImpactGames,
              clutchRating: player.impactStats[0].clutchRating
                ? Number(player.impactStats[0].clutchRating)
                : null,
            }
          : null,
        valueScore: score
          ? {
              overallScore: score.overallScore,
              grade: score.grade,
              positionGroup: score.positionGroup,
              aavTier: score.aavTier,
              components: score.components as Record<
                string,
                {
                  score: number;
                  weight: number;
                  rawValue: number;
                  benchmark: number;
                  label: string;
                }
              >,
              estimatedWAR: score.estimatedWAR
                ? Number(score.estimatedWAR)
                : null,
              costPerPoint: score.costPerPoint
                ? Number(score.costPerPoint)
                : null,
              costPerGoal: score.costPerGoal
                ? Number(score.costPerGoal)
                : null,
              costPerWAR: score.costPerWAR ? Number(score.costPerWAR) : null,
              peerRank: score.peerRank,
              leagueRank: score.leagueRank,
              calculatedAt: score.calculatedAt,
            }
          : null,
        careerImpactStats: careerImpact.length > 0
          ? {
              seasons: careerImpact.length,
              avgWinPctDifferential:
                careerImpact.filter((c) => c.winPctDifferential != null).length > 0
                  ? careerImpact.reduce((s, c) => s + (c.winPctDifferential ? Number(c.winPctDifferential) : 0), 0) /
                    careerImpact.filter((c) => c.winPctDifferential != null).length
                  : null,
              avgClutchRating:
                careerImpact.filter((c) => c.clutchRating != null).length > 0
                  ? careerImpact.reduce((s, c) => s + (c.clutchRating ? Number(c.clutchRating) : 0), 0) /
                    careerImpact.filter((c) => c.clutchRating != null).length
                  : null,
              totalHighImpactGames: careerImpact.reduce((s, c) => s + (c.highImpactGames ?? 0), 0),
              avgGameScore:
                careerImpact.filter((c) => c.gameScore != null).length > 0
                  ? careerImpact.reduce((s, c) => s + (c.gameScore ? Number(c.gameScore) : 0), 0) /
                    careerImpact.filter((c) => c.gameScore != null).length
                  : null,
            }
          : null,
      };
    }),

  // ── Advanced analytics ──
  getAdvancedStats: protectedProcedure
    .input(
      z.object({ playerId: z.string(), season: z.string().optional() }),
    )
    .query(async ({ input }) => {
      const season = input.season ?? (await getLatestSeason());

      const [advanced, stats] = await Promise.all([
        prisma.advancedStats.findUnique({
          where: {
            playerId_season: { playerId: input.playerId, season },
          },
        }),
        prisma.seasonStats.findUnique({
          where: {
            playerId_season: { playerId: input.playerId, season },
          },
        }),
      ]);

      return {
        season,
        advanced: advanced
          ? {
              corsiForPct: advanced.corsiForPct
                ? Number(advanced.corsiForPct)
                : null,
              fenwickForPct: advanced.fenwickForPct
                ? Number(advanced.fenwickForPct)
                : null,
              xGFPct: advanced.xGFPct ? Number(advanced.xGFPct) : null,
              goalsForPct: advanced.goalsForPct
                ? Number(advanced.goalsForPct)
                : null,
              relCorsiForPct: advanced.relCorsiForPct
                ? Number(advanced.relCorsiForPct)
                : null,
              relXGFPct: advanced.relXGFPct
                ? Number(advanced.relXGFPct)
                : null,
              individualExpectedGoals: advanced.individualExpectedGoals
                ? Number(advanced.individualExpectedGoals)
                : null,
              individualHighDangerChances:
                advanced.individualHighDangerChances,
              offensiveZoneStartPct: advanced.offensiveZoneStartPct
                ? Number(advanced.offensiveZoneStartPct)
                : null,
              defensiveZoneStartPct: advanced.defensiveZoneStartPct
                ? Number(advanced.defensiveZoneStartPct)
                : null,
              onIceShootingPct: advanced.onIceShootingPct
                ? Number(advanced.onIceShootingPct)
                : null,
              onIceSavePct: advanced.onIceSavePct
                ? Number(advanced.onIceSavePct)
                : null,
              pdo: advanced.pdo ? Number(advanced.pdo) : null,
            }
          : null,
        specialTeams: stats
          ? {
              powerPlayGoals: stats.powerPlayGoals,
              powerPlayAssists: stats.powerPlayAssists,
              powerPlayPoints: stats.powerPlayPoints,
              powerPlayToi: stats.powerPlayToi
                ? Number(stats.powerPlayToi)
                : null,
              shortHandedGoals: stats.shortHandedGoals,
              shortHandedAssists: stats.shortHandedAssists,
              shortHandedPoints: stats.shortHandedPoints,
              shortHandedToi: stats.shortHandedToi
                ? Number(stats.shortHandedToi)
                : null,
              evenStrengthGoals: stats.evenStrengthGoals,
              evenStrengthAssists: stats.evenStrengthAssists,
              evenStrengthPoints: stats.evenStrengthPoints,
            }
          : null,
        shooting: stats
          ? {
              shots: stats.shots,
              shootingPct: Number(stats.shootingPct ?? 0),
              goals: stats.goals,
              gamesPlayed: stats.gamesPlayed,
              ixG: advanced?.individualExpectedGoals
                ? Number(advanced.individualExpectedGoals)
                : null,
              iHDCF: advanced?.individualHighDangerChances ?? null,
            }
          : null,
      };
    }),

  // ── Contract intelligence ──
  getContractIntel: protectedProcedure
    .input(z.object({ playerId: z.string() }))
    .query(async ({ input }) => {
      const season = await getLatestSeason();

      const player = await prisma.player.findUniqueOrThrow({
        where: { id: input.playerId },
        include: {
          contracts: {
            orderBy: { startYear: "desc" as const },
            take: 1,
          },
          seasonStats: { where: { season }, take: 1 },
          goalieStats: { where: { season }, take: 1 },
          advancedStats: { where: { season }, take: 1 },
          valueScores: {
            orderBy: { calculatedAt: "desc" as const },
            take: 1,
          },
        },
      });

      const contract = player.contracts[0];
      const stats = player.seasonStats[0];
      const goalie = player.goalieStats?.[0];
      const advanced = player.advancedStats?.[0];
      const score = player.valueScores[0];
      const age = getAge(player.birthDate);

      if (!contract) {
        return {
          contract: null,
          fullCapHitByYear: {} as Record<string, number>,
          valueScoreBySeason: {} as Record<string, { score: number; grade: string | null }>,
          projection: null,
          gmNote: null,
          efficiencyRanking: [],
        };
      }

      const posGroup = getPositionGroup(player.position as Position);
      const valueInput = buildPlayerValueInput(
        player.position,
        age,
        contract,
        stats,
        goalie,
        advanced,
      );

      let projection = null;
      try {
        const proj = await projectNextContract(valueInput, prisma);
        projection = {
          projectedAAV: proj.projectedAAV,
          projectedTerm: proj.projectedTerm,
          confidence: proj.confidence,
          comparables: proj.comparables,
          factors: proj.factors,
        };
      } catch {
        // Projection may fail without enough data
      }

      const gmNote = generateGMNote(
        player.fullName,
        age,
        score ?? null,
        Number(contract.aav),
        contract.endYear,
        stats ? { gamesPlayed: stats.gamesPlayed, points: stats.points } : null,
        projection,
      );

      const efficiencyRanking = await getCostEfficiencyRanking(
        posGroup,
        season,
      );

      // Fetch ALL contracts to build complete year-by-year cap hit timeline
      const allContracts = await prisma.contract.findMany({
        where: { playerId: input.playerId },
        orderBy: { startYear: "asc" },
        select: {
          startYear: true,
          endYear: true,
          aav: true,
          capHitByYear: true,
          status: true,
        },
      });

      // Build unified year-by-year map across all contracts
      // Values are normalised to full dollars (e.g. 9_500_000, not 9.5)
      const fullCapHitByYear: Record<string, number> = {};
      for (const c of allContracts) {
        const byYear = c.capHitByYear as Record<string, unknown> | null;
        if (byYear) {
          for (const [key, raw] of Object.entries(byYear)) {
            let val = Number(raw);
            // If the value looks like it was stored in millions (< 100_000), convert
            if (val > 0 && val < 100_000) val = val * 1_000_000;
            fullCapHitByYear[key] = val;
          }
        } else {
          // Fallback: fill each year of the contract with the AAV
          const aav = Number(c.aav);
          for (let y = c.startYear; y < c.endYear; y++) {
            const endYr = y + 1;
            const key = `${y}-${String(endYr).slice(2)}`;
            fullCapHitByYear[key] = aav;
          }
        }
      }

      // Fetch historical value scores (latest per season) for year-by-year display
      const allScores = await prisma.playerValueScore.findMany({
        where: { playerId: input.playerId },
        orderBy: { calculatedAt: "desc" },
        distinct: ["season"],
        select: {
          season: true,
          overallScore: true,
          grade: true,
        },
      });
      const valueScoreBySeason: Record<string, { score: number; grade: string | null }> = {};
      for (const s of allScores) {
        // Season format in value scores is "20252026"; capHitByYear keys are "2025-26"
        const startYear = s.season.substring(0, 4);
        const endYear = s.season.substring(4, 8);
        const key = `${startYear}-${endYear.slice(2)}`;
        valueScoreBySeason[key] = { score: s.overallScore, grade: s.grade };
      }

      return {
        contract: {
          aav: Number(contract.aav),
          totalValue: Number(contract.totalValue),
          totalYears: contract.totalYears,
          startYear: contract.startYear,
          endYear: contract.endYear,
          yearsRemaining: Math.max(0, contract.endYear - CURRENT_SEASON_END),
          structure: contract.structure,
          hasNTC: contract.hasNTC,
          hasNMC: contract.hasNMC,
          tradeProtectionDetails: contract.tradeProtectionDetails,
          signingType: contract.signingType,
          signingAge: contract.signingAge,
          capHitByYear: contract.capHitByYear as Record<string, number>,
        },
        fullCapHitByYear,
        valueScoreBySeason,
        projection,
        gmNote,
        efficiencyRanking,
      };
    }),

  // ── Peer comparables ──
  getComparables: protectedProcedure
    .input(z.object({ playerId: z.string() }))
    .query(async ({ input }) => {
      const season = await getLatestSeason();

      const player = await prisma.player.findUniqueOrThrow({
        where: { id: input.playerId },
        include: {
          contracts: {
            orderBy: { startYear: "desc" as const },
            take: 1,
          },
          seasonStats: { where: { season }, take: 1 },
          goalieStats: { where: { season }, take: 1 },
          advancedStats: { where: { season }, take: 1 },
          valueScores: {
            orderBy: { calculatedAt: "desc" as const },
            take: 1,
          },
        },
      });

      const contract = player.contracts[0];
      const stats = player.seasonStats[0];
      const goalie = player.goalieStats?.[0];
      const advanced = player.advancedStats?.[0];
      const score = player.valueScores[0];
      const age = getAge(player.birthDate);

      if (!contract) {
        return { peers: null, historicalComps: null, leagueRanking: [] };
      }

      const valueInput = buildPlayerValueInput(
        player.position,
        age,
        contract,
        stats,
        goalie,
        advanced,
      );

      let peers = null;
      try {
        const result = await findComparableContracts(valueInput, prisma, {
          aavTolerancePct: 20,
          ageToleranceYears: 3,
          maxResults: 15,
          season,
        });
        peers = {
          player: result.player,
          peers: result.peers,
          rank: result.rank,
          percentile: result.percentile,
          summary: result.summary,
        };
      } catch {
        // May fail without enough data
      }

      let historicalComps = null;
      try {
        const proj = await projectNextContract(valueInput, prisma);
        historicalComps = proj.comparables;
      } catch {
        // May fail
      }

      // League-wide ranking
      const allScores = await prisma.playerValueScore.findMany({
        where: { season },
        orderBy: { calculatedAt: "desc" },
        distinct: ["playerId"],
        include: {
          player: {
            select: {
              fullName: true,
              position: true,
              currentTeam: { select: { abbreviation: true } },
            },
          },
        },
      });

      allScores.sort((a, b) => b.overallScore - a.overallScore);

      const leagueRanking = allScores.slice(0, 50).map((s, i) => ({
        rank: i + 1,
        playerId: s.playerId,
        playerName: s.player.fullName,
        position: s.player.position,
        teamAbbreviation: s.player.currentTeam?.abbreviation ?? null,
        overallScore: s.overallScore,
        isSubject: s.playerId === input.playerId,
      }));

      if (!leagueRanking.some((r) => r.isSubject) && score) {
        const subjectIdx = allScores.findIndex(
          (s) => s.playerId === input.playerId,
        );
        if (subjectIdx >= 0) {
          leagueRanking.push({
            rank: subjectIdx + 1,
            playerId: input.playerId,
            playerName: player.fullName,
            position: player.position,
            teamAbbreviation: null,
            overallScore: score.overallScore,
            isSubject: true,
          });
        }
      }

      return { peers, historicalComps, leagueRanking };
    }),

  // ── Career stats (all seasons) ──
  getCareerStats: protectedProcedure
    .input(z.object({ playerId: z.string() }))
    .query(async ({ input }) => {
      const player = await prisma.player.findUniqueOrThrow({
        where: { id: input.playerId },
        select: { position: true },
      });

      const isGoalie = player.position === "G";

      if (isGoalie) {
        const seasons = await prisma.goalieStats.findMany({
          where: { playerId: input.playerId },
          orderBy: { season: "desc" },
          include: { team: { select: { abbreviation: true, name: true } } },
        });
        return {
          type: "goalie" as const,
          skaterSeasons: [],
          goalieSeasons: seasons.map((s) => ({
            season: s.season,
            seasonLabel: `${s.season.substring(0, 4)}–${s.season.substring(4)}`,
            teamAbbrev: s.team?.abbreviation ?? "—",
            teamName: s.team?.name ?? "—",
            gp: s.gamesPlayed,
            gs: s.gamesStarted,
            w: s.wins,
            l: s.losses,
            otl: s.otLosses,
            svPct: s.savePercentage ? Number(s.savePercentage) : 0,
            gaa: s.goalsAgainstAvg ? Number(s.goalsAgainstAvg) : 0,
            so: s.shutouts,
            sa: s.shotsAgainst,
            sv: s.saves,
          })),
        };
      }

      const seasons = await prisma.seasonStats.findMany({
        where: { playerId: input.playerId },
        orderBy: { season: "desc" },
        include: { team: { select: { abbreviation: true, name: true } } },
      });
      return {
        type: "skater" as const,
        skaterSeasons: seasons.map((s) => ({
          season: s.season,
          seasonLabel: `${s.season.substring(0, 4)}–${s.season.substring(4)}`,
          teamAbbrev: s.team?.abbreviation ?? "—",
          teamName: s.team?.name ?? "—",
          gp: s.gamesPlayed,
          g: s.goals,
          a: s.assists,
          pts: s.points,
          pm: s.plusMinus,
          pim: s.pim,
          toi: s.toiPerGame ? Number(s.toiPerGame) : 0,
          shots: s.shots,
          shPct: s.shootingPct ? Number(s.shootingPct) : 0,
          ppg: s.powerPlayGoals,
          ppa: s.powerPlayAssists,
          ppPts: s.powerPlayPoints,
          shg: s.shortHandedGoals,
          shPts: s.shortHandedPoints,
          hits: s.hits,
          blk: s.blocks,
        })),
        goalieSeasons: [],
      };
    }),

  // ── Contract history (all contracts) ──
  getContractHistory: protectedProcedure
    .input(z.object({ playerId: z.string() }))
    .query(async ({ input }) => {
      const contracts = await prisma.contract.findMany({
        where: { playerId: input.playerId },
        orderBy: { startYear: "desc" },
        include: { team: { select: { abbreviation: true, name: true } } },
      });
      return contracts.map((c) => ({
        id: c.id,
        teamAbbrev: c.team.abbreviation,
        teamName: c.team.name,
        startYear: c.startYear,
        endYear: c.endYear,
        totalYears: c.totalYears,
        aav: Number(c.aav),
        totalValue: Number(c.totalValue),
        structure: c.structure,
        signingType: c.signingType,
        signingAge: c.signingAge,
        hasNTC: c.hasNTC,
        hasNMC: c.hasNMC,
        source: c.source,
        capHitByYear: c.capHitByYear as Record<string, number>,
        status: c.status,
      }));
    }),

  // ── Production history across seasons ──
  getHistory: protectedProcedure
    .input(z.object({ playerId: z.string() }))
    .query(async ({ input }) => {
      const [stats, valueScores, contracts] = await Promise.all([
        prisma.seasonStats.findMany({
          where: { playerId: input.playerId },
          orderBy: { season: "asc" },
          select: {
            season: true,
            gamesPlayed: true,
            goals: true,
            assists: true,
            points: true,
          },
        }),
        prisma.playerValueScore.findMany({
          where: { playerId: input.playerId },
          orderBy: { calculatedAt: "desc" },
          distinct: ["season" as const],
          select: { season: true, overallScore: true, grade: true },
        }),
        prisma.contract.findMany({
          where: { playerId: input.playerId },
          orderBy: { startYear: "asc" },
          select: { startYear: true, endYear: true, aav: true },
        }),
      ]);

      const scoreMap = new Map(valueScores.map((v) => [v.season, v]));

      return stats.map((s) => {
        const score = scoreMap.get(s.season);
        const seasonStart = parseInt(s.season.substring(0, 4));
        const seasonEnd = parseInt(s.season.substring(4));
        const contract = contracts.find(
          (c) => c.startYear <= seasonStart && c.endYear >= seasonEnd,
        );

        return {
          season: s.season,
          seasonLabel: `${s.season.substring(0, 4)}–${s.season.substring(4)}`,
          gamesPlayed: s.gamesPlayed,
          goals: s.goals,
          assists: s.assists,
          points: s.points,
          overallScore: score?.overallScore ?? null,
          grade: score?.grade ?? null,
          aav: contract ? Number(contract.aav) : null,
        };
      });
    }),

  // ── Goalie-specific analytics ──
  getGoalieAnalytics: protectedProcedure
    .input(z.object({ playerId: z.string() }))
    .query(async ({ input }) => {
      const player = await prisma.player.findUniqueOrThrow({
        where: { id: input.playerId },
        select: {
          id: true,
          fullName: true,
          position: true,
          currentTeamId: true,
          goalieStats: {
            orderBy: { season: "desc" },
            select: {
              season: true,
              gamesPlayed: true,
              gamesStarted: true,
              wins: true,
              losses: true,
              otLosses: true,
              savePercentage: true,
              goalsAgainstAvg: true,
              shotsAgainst: true,
              saves: true,
              shutouts: true,
              qualityStarts: true,
              qualityStartPct: true,
              goalsAboveExpected: true,
              highDangerSavePct: true,
              mediumDangerSavePct: true,
              lowDangerSavePct: true,
            },
          },
          contracts: {
            orderBy: { startYear: "desc" as const },
            take: 1,
            select: { aav: true },
          },
        },
      });

      if (player.position !== "G" || player.goalieStats.length === 0) {
        return null;
      }

      // Save % by danger zone for each season
      const dangerZoneData = player.goalieStats.map((s) => ({
        season: s.season,
        seasonLabel: `${s.season.substring(0, 4)}–${s.season.substring(4)}`,
        highDanger: s.highDangerSavePct ? Number(s.highDangerSavePct) : null,
        mediumDanger: s.mediumDangerSavePct
          ? Number(s.mediumDangerSavePct)
          : null,
        lowDanger: s.lowDangerSavePct ? Number(s.lowDangerSavePct) : null,
        overall: Number(s.savePercentage ?? 0),
      }));

      // GSAx trend across seasons
      const gsaxTrend = player.goalieStats.map((s) => ({
        season: s.season,
        seasonLabel: `${s.season.substring(0, 4)}–${s.season.substring(4)}`,
        gsax: s.goalsAboveExpected
          ? Number(s.goalsAboveExpected)
          : (Number(s.savePercentage ?? 0.91) - 0.91) *
            (s.shotsAgainst || 0),
        gamesStarted: s.gamesStarted,
      }));

      // Workload analysis
      const workloadData = player.goalieStats.map((s) => ({
        season: s.season,
        seasonLabel: `${s.season.substring(0, 4)}–${s.season.substring(4)}`,
        gamesStarted: s.gamesStarted,
        gamesPlayed: s.gamesPlayed,
        savePercentage: Number(s.savePercentage ?? 0),
        wins: s.wins,
        qualityStartPct: s.qualityStartPct
          ? Number(s.qualityStartPct)
          : null,
      }));

      // Crease share — find tandem partner(s) on same team
      let creaseShare = null;
      if (player.currentTeamId) {
        const teammates = await prisma.player.findMany({
          where: {
            currentTeamId: player.currentTeamId,
            position: "G",
            isActive: true,
            id: { not: player.id },
          },
          select: {
            id: true,
            fullName: true,
            goalieStats: {
              orderBy: { season: "desc" },
              take: 1,
              select: {
                gamesStarted: true,
                gamesPlayed: true,
                savePercentage: true,
                goalsAgainstAvg: true,
                wins: true,
              },
            },
          },
        });

        const currentStats = player.goalieStats[0];
        const partnerStats = teammates
          .filter((t) => t.goalieStats.length > 0)
          .map((t) => ({
            playerId: t.id,
            playerName: t.fullName,
            gamesStarted: t.goalieStats[0].gamesStarted,
            savePercentage: Number(t.goalieStats[0].savePercentage ?? 0),
            goalsAgainstAvg: Number(
              t.goalieStats[0].goalsAgainstAvg ?? 0,
            ),
            wins: t.goalieStats[0].wins,
          }));

        if (partnerStats.length > 0) {
          const totalGS =
            currentStats.gamesStarted +
            partnerStats.reduce((s, p) => s + p.gamesStarted, 0);
          creaseShare = {
            player: {
              playerName: player.fullName,
              gamesStarted: currentStats.gamesStarted,
              sharePercent:
                totalGS > 0
                  ? Math.round(
                      (currentStats.gamesStarted / totalGS) * 100,
                    )
                  : 0,
              savePercentage: Number(currentStats.savePercentage ?? 0),
              wins: currentStats.wins,
            },
            partners: partnerStats.map((p) => ({
              ...p,
              sharePercent:
                totalGS > 0
                  ? Math.round((p.gamesStarted / totalGS) * 100)
                  : 0,
            })),
          };
        }
      }

      // Positional benchmark comparison at similar AAV
      const aav = player.contracts[0] ? Number(player.contracts[0].aav) : 0;
      const season = player.goalieStats[0]?.season;
      let aavBenchmark = null;
      if (aav > 0 && season) {
        const similar = await prisma.player.findMany({
          where: {
            position: "G",
            isActive: true,
            id: { not: player.id },
            contracts: {
              some: {
                aav: {
                  gte: aav * 0.6,
                  lte: aav * 1.4,
                },
              },
            },
          },
          select: {
            fullName: true,
            goalieStats: {
              where: { season },
              take: 1,
              select: {
                savePercentage: true,
                goalsAgainstAvg: true,
                gamesStarted: true,
                qualityStartPct: true,
                goalsAboveExpected: true,
              },
            },
            valueScores: {
              where: { season },
              orderBy: { calculatedAt: "desc" as const },
              take: 1,
              select: { overallScore: true },
            },
          },
          take: 10,
        });

        aavBenchmark = similar
          .filter((s) => s.goalieStats.length > 0)
          .map((s) => ({
            playerName: s.fullName,
            savePercentage: Number(s.goalieStats[0].savePercentage ?? 0),
            goalsAgainstAvg: Number(
              s.goalieStats[0].goalsAgainstAvg ?? 0,
            ),
            gamesStarted: s.goalieStats[0].gamesStarted,
            qualityStartPct: s.goalieStats[0].qualityStartPct
              ? Number(s.goalieStats[0].qualityStartPct)
              : null,
            gsax: s.goalieStats[0].goalsAboveExpected
              ? Number(s.goalieStats[0].goalsAboveExpected)
              : null,
            valueScore: s.valueScores[0]?.overallScore ?? null,
          }));
      }

      return {
        dangerZoneData,
        gsaxTrend,
        workloadData,
        creaseShare,
        aavBenchmark,
        isStarter: player.goalieStats[0]?.gamesStarted >= 40,
      };
    }),
});
