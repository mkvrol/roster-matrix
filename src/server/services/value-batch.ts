// ──────────────────────────────────────────────
// Roster Matrix — Value Score Batch Calculator
// Calculates and stores value scores for all players
// ──────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { notifyScoreChanges } from "@/server/services/notifications";
import {
  calculateValueScore,
  getPositionGroup,
} from "@/lib/value-engine";
import type {
  ValueInput,
  Position,
  ValueScoreResult,
  ValueComponents,
} from "@/lib/value-engine";

// ── Result types ──

export interface BatchResult {
  season: string;
  processed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  failures: Array<{ playerId: string; playerName: string; error: string }>;
}

// ── Main batch entry point ──

export async function calculateAllValueScores(
  season?: string,
): Promise<BatchResult> {
  const startedAt = Date.now();
  const targetSeason = season ?? (await getLatestSeason());

  console.log(
    `[ValueBatch] Starting batch calculation for season ${targetSeason}`,
  );

  // Delete existing scores for this season so we replace, not duplicate
  await prisma.playerValueScore.deleteMany({
    where: { season: targetSeason },
  });

  // Fetch latest 2 seasons of stats so we can fall back to previous season
  // for players missing current-season data (e.g. Barkov injured all year)
  const players = await prisma.player.findMany({
    where: { isActive: true },
    include: {
      contracts: {
        where: { status: "ACTIVE" },
        orderBy: { startYear: "desc" },
        take: 1,
      },
      seasonStats: {
        orderBy: { season: "desc" },
        take: 2,
      },
      goalieStats: {
        orderBy: { season: "desc" },
        take: 2,
      },
      advancedStats: {
        orderBy: { season: "desc" },
        take: 2,
      },
      impactStats: {
        orderBy: { season: "desc" },
        take: 2,
      },
    },
  });

  let processed = 0;
  let skipped = 0;
  const failures: BatchResult["failures"] = [];
  const scores: Array<{
    playerId: string;
    result: ValueScoreResult;
  }> = [];

  for (const player of players) {
    const contract = player.contracts[0];
    if (!contract) {
      skipped++;
      continue;
    }

    const posGroup = getPositionGroup(player.position as Position);

    // Prefer current season stats; fall back to most recent season
    const stats =
      player.seasonStats.find((s) => s.season === targetSeason) ??
      player.seasonStats[0];
    const goalie =
      player.goalieStats.find((s) => s.season === targetSeason) ??
      player.goalieStats[0];
    const advanced =
      player.advancedStats.find((s) => s.season === targetSeason) ??
      player.advancedStats[0];
    const impact =
      player.impactStats.find((s) => s.season === targetSeason) ??
      player.impactStats[0];

    if (posGroup === "G" && !goalie) {
      skipped++;
      continue;
    }
    if (posGroup !== "G" && !stats) {
      skipped++;
      continue;
    }

    try {
      const input = buildValueInput(player, contract, stats, goalie, advanced, impact);
      const result = calculateValueScore(input);
      scores.push({ playerId: player.id, result });
      processed++;
    } catch (error) {
      failures.push({
        playerId: player.id,
        playerName: player.fullName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Compute league-wide rankings (descending by overall score)
  scores.sort((a, b) => b.result.overall - a.result.overall);
  const leagueRanks = new Map<string, number>();
  scores.forEach((s, i) => leagueRanks.set(s.playerId, i + 1));

  // Compute peer rankings (same position group + AAV tier)
  const peerGroups = new Map<string, typeof scores>();
  for (const s of scores) {
    const key = `${s.result.meta.positionGroup}:${s.result.meta.aavTier}`;
    if (!peerGroups.has(key)) peerGroups.set(key, []);
    peerGroups.get(key)!.push(s);
  }

  const peerRanks = new Map<string, number>();
  Array.from(peerGroups.values()).forEach((group) => {
    group.sort((a, b) => b.result.overall - a.result.overall);
    group.forEach((s, i) => peerRanks.set(s.playerId, i + 1));
  });

  // Batch insert all scores
  await prisma.playerValueScore.createMany({
    data: scores.map((s) => {
      const r = s.result;
      const m = r.meta;
      const componentScores = mapComponentScores(m.positionGroup, r.components);

      return {
        playerId: s.playerId,
        season: targetSeason,
        overallScore: r.overall,
        grade: r.grade,
        positionGroup: m.positionGroup,
        aavTier: m.aavTier,
        components: r.components as object,
        ...componentScores,
        estimatedWAR: m.estimatedWAR,
        costPerPoint: m.costPerPoint ?? null,
        costPerGoal: m.costPerGoal ?? null,
        costPerWAR: m.costPerWAR,
        peerRank: peerRanks.get(s.playerId) ?? null,
        leagueRank: leagueRanks.get(s.playerId) ?? null,
      };
    }),
  });

  // Notify users about significant score changes
  try {
    await notifyScoreChanges(targetSeason);
  } catch (error) {
    console.error("[ValueBatch] Failed to send score change notifications:", error);
  }

  const durationMs = Date.now() - startedAt;
  console.log(
    `[ValueBatch] Completed: ${processed} processed, ${skipped} skipped, ${failures.length} failed in ${durationMs}ms`,
  );

  return {
    season: targetSeason,
    processed,
    failed: failures.length,
    skipped,
    durationMs,
    failures,
  };
}

// ── Single player recalculation ──

export async function calculateSinglePlayerScore(
  playerId: string,
  season?: string,
): Promise<ValueScoreResult> {
  const targetSeason = season ?? (await getLatestSeason());

  const player = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    include: {
      contracts: {
        where: { status: "ACTIVE" },
        orderBy: { startYear: "desc" },
        take: 1,
      },
      seasonStats: {
        orderBy: { season: "desc" },
        take: 2,
      },
      goalieStats: {
        orderBy: { season: "desc" },
        take: 2,
      },
      advancedStats: {
        orderBy: { season: "desc" },
        take: 2,
      },
      impactStats: {
        orderBy: { season: "desc" },
        take: 2,
      },
    },
  });

  const contract = player.contracts[0];
  if (!contract) throw new Error("Player has no contract data");

  const posGroup = getPositionGroup(player.position as Position);
  const stats =
    player.seasonStats.find((s) => s.season === targetSeason) ??
    player.seasonStats[0];
  const goalie =
    player.goalieStats.find((s) => s.season === targetSeason) ??
    player.goalieStats[0];
  const advanced =
    player.advancedStats.find((s) => s.season === targetSeason) ??
    player.advancedStats[0];
  const impact =
    player.impactStats.find((s) => s.season === targetSeason) ??
    player.impactStats[0];

  if (posGroup === "G" && !goalie)
    throw new Error("Goalie has no stats for this season");
  if (posGroup !== "G" && !stats)
    throw new Error("Player has no stats for this season");

  const input = buildValueInput(player, contract, stats, goalie, advanced, impact);
  const result = calculateValueScore(input);
  const componentScores = mapComponentScores(
    result.meta.positionGroup,
    result.components,
  );

  await prisma.playerValueScore.create({
    data: {
      playerId: player.id,
      season: targetSeason,
      overallScore: result.overall,
      grade: result.grade,
      positionGroup: result.meta.positionGroup,
      aavTier: result.meta.aavTier,
      components: result.components as object,
      ...componentScores,
      estimatedWAR: result.meta.estimatedWAR,
      costPerPoint: result.meta.costPerPoint ?? null,
      costPerGoal: result.meta.costPerGoal ?? null,
      costPerWAR: result.meta.costPerWAR,
    },
  });

  return result;
}

// ── Historical batch (all seasons) ──

export async function calculateHistoricalValueScores(): Promise<BatchResult[]> {
  const seasons = await prisma.seasonStats.findMany({
    select: { season: true },
    distinct: ["season"],
    orderBy: { season: "asc" },
  });

  const results: BatchResult[] = [];
  for (const { season } of seasons) {
    const result = await calculateAllValueScores(season);
    results.push(result);
  }
  return results;
}

// ── Helpers ──

export async function getLatestSeason(): Promise<string> {
  const latest = await prisma.seasonStats.findFirst({
    orderBy: { season: "desc" },
    select: { season: true },
  });
  return latest?.season ?? "20242025";
}

function getAgeFromBirthDate(bd: Date | null): number {
  if (!bd) return 27;
  const now = new Date();
  let years = now.getFullYear() - bd.getFullYear();
  if (
    now.getMonth() < bd.getMonth() ||
    (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())
  ) {
    years--;
  }
  return years;
}

function buildValueInput(
  player: {
    position: string;
    birthDate: Date | null;
  },
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
  stats: {
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
  } | undefined,
  goalie: {
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
  } | undefined,
  advanced: {
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
  } | undefined,
  impact: {
    winPctDifferential: unknown;
    clutchRating: unknown;
    pointsPerGameInWins: unknown;
    goalsPerGameInWins: unknown;
    highImpactGames: number;
    gameScore: unknown;
    onIceGoalsForPer60: unknown;
    onIceGoalsAgainstPer60: unknown;
  } | undefined,
): ValueInput {
  const posGroup = getPositionGroup(player.position as Position);
  const age = getAgeFromBirthDate(player.birthDate);

  const input: ValueInput = {
    player: { position: player.position as Position, age },
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
        relXGFPct: advanced.relXGFPct
          ? Number(advanced.relXGFPct)
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

  if (impact) {
    input.impact = {
      winPctDifferential: impact.winPctDifferential
        ? Number(impact.winPctDifferential)
        : undefined,
      clutchRating: impact.clutchRating
        ? Number(impact.clutchRating)
        : undefined,
      pointsPerGameInWins: impact.pointsPerGameInWins
        ? Number(impact.pointsPerGameInWins)
        : undefined,
      goalsPerGameInWins: impact.goalsPerGameInWins
        ? Number(impact.goalsPerGameInWins)
        : undefined,
      highImpactGames: impact.highImpactGames ?? undefined,
      gameScore: impact.gameScore
        ? Number(impact.gameScore)
        : undefined,
      onIceGoalsForPer60: impact.onIceGoalsForPer60
        ? Number(impact.onIceGoalsForPer60)
        : undefined,
      onIceGoalsAgainstPer60: impact.onIceGoalsAgainstPer60
        ? Number(impact.onIceGoalsAgainstPer60)
        : undefined,
    };
  }

  return input;
}

function mapComponentScores(
  positionGroup: string,
  components: ValueComponents,
) {
  const c = components as unknown as Record<string, { score?: number }>;

  switch (positionGroup) {
    case "F":
      return {
        scoringComponent: c.pointsPerMillion?.score ?? null,
        fiveOnFiveComponent: c.fiveOnFiveImpact?.score ?? null,
        specialTeamsComponent: c.specialTeams?.score ?? null,
        durabilityComponent: c.durability?.score ?? null,
        efficiencyComponent: c.shootingEfficiency?.score ?? null,
        warPerMillionComponent: c.warPerDollar?.score ?? null,
        ageCurveComponent: c.ageCurve?.score ?? null,
      };
    case "D":
      return {
        scoringComponent: c.pointsPerMillion?.score ?? null,
        fiveOnFiveComponent: c.fiveOnFiveImpact?.score ?? null,
        specialTeamsComponent: c.specialTeams?.score ?? null,
        durabilityComponent: c.durability?.score ?? null,
        efficiencyComponent: c.defensiveMetrics?.score ?? null,
        warPerMillionComponent: c.warPerDollar?.score ?? null,
        ageCurveComponent: c.ageCurve?.score ?? null,
      };
    case "G":
      return {
        scoringComponent: c.gsaxPerDollar?.score ?? null,
        fiveOnFiveComponent: c.qualityStarts?.score ?? null,
        specialTeamsComponent: c.winContribution?.score ?? null,
        durabilityComponent: c.durability?.score ?? null,
        efficiencyComponent: c.highDangerSavePct?.score ?? null,
        warPerMillionComponent: c.workloadValue?.score ?? null,
        ageCurveComponent: c.saveVsExpected?.score ?? null,
      };
    default:
      return {};
  }
}
