import { prisma } from "@/lib/prisma";

interface DataIssue {
  entity: string;
  id: string;
  field: string;
  issue: string;
  severity: "error" | "warning" | "info";
  value?: string;
}

export interface DataQualityReport {
  generatedAt: string;
  summary: {
    totalPlayers: number;
    activePlayers: number;
    totalSeasonStats: number;
    totalGoalieStats: number;
    totalAdvancedStats: number;
    totalContracts: number;
    totalIssues: number;
    errors: number;
    warnings: number;
  };
  staleness: {
    playersNotUpdatedIn48h: number;
    lastStatSync: string | null;
  };
  issues: DataIssue[];
}

export async function generateDataQualityReport(): Promise<DataQualityReport> {
  const issues: DataIssue[] = [];

  // Counts
  const [
    totalPlayers,
    activePlayers,
    totalSeasonStats,
    totalGoalieStats,
    totalAdvancedStats,
    totalContracts,
  ] = await Promise.all([
    prisma.player.count(),
    prisma.player.count({ where: { isActive: true } }),
    prisma.seasonStats.count(),
    prisma.goalieStats.count(),
    prisma.advancedStats.count(),
    prisma.contract.count(),
  ]);

  // ── Season Stats Validation ──
  const badSeasonStats = await prisma.seasonStats.findMany({
    where: {
      OR: [
        { gamesPlayed: { lt: 0 } },
        { goals: { lt: 0 } },
        { assists: { lt: 0 } },
        { shots: { lt: 0 } },
      ],
    },
    select: { id: true, playerId: true, season: true, gamesPlayed: true, goals: true, assists: true, shots: true },
  });

  for (const s of badSeasonStats) {
    if (s.gamesPlayed < 0)
      issues.push({
        entity: "SeasonStats",
        id: s.id,
        field: "gamesPlayed",
        issue: "Negative games played",
        severity: "error",
        value: String(s.gamesPlayed),
      });
    if (s.goals < 0)
      issues.push({
        entity: "SeasonStats",
        id: s.id,
        field: "goals",
        issue: "Negative goals",
        severity: "error",
        value: String(s.goals),
      });
    if (s.assists < 0)
      issues.push({
        entity: "SeasonStats",
        id: s.id,
        field: "assists",
        issue: "Negative assists",
        severity: "error",
        value: String(s.assists),
      });
    if (s.shots < 0)
      issues.push({
        entity: "SeasonStats",
        id: s.id,
        field: "shots",
        issue: "Negative shots",
        severity: "error",
        value: String(s.shots),
      });
  }

  // Points != goals + assists
  const mismatchedPoints = await prisma.seasonStats.findMany({
    where: { gamesPlayed: { gt: 0 } },
    select: { id: true, goals: true, assists: true, points: true },
  });

  for (const s of mismatchedPoints) {
    if (s.points !== s.goals + s.assists) {
      issues.push({
        entity: "SeasonStats",
        id: s.id,
        field: "points",
        issue: `Points (${s.points}) != goals (${s.goals}) + assists (${s.assists})`,
        severity: "warning",
      });
    }
  }

  // Shooting % over 50
  const highShootingPct = await prisma.seasonStats.findMany({
    where: {
      shootingPct: { gt: 50 },
      gamesPlayed: { gte: 10 },
    },
    select: { id: true, shootingPct: true },
  });

  for (const s of highShootingPct) {
    issues.push({
      entity: "SeasonStats",
      id: s.id,
      field: "shootingPct",
      issue: "Shooting percentage over 50%",
      severity: "warning",
      value: s.shootingPct?.toString(),
    });
  }

  // More goals than shots
  const goalsOverShots = await prisma.seasonStats.findMany({
    where: { gamesPlayed: { gt: 0 } },
    select: { id: true, goals: true, shots: true },
  });

  for (const s of goalsOverShots) {
    if (s.shots > 0 && s.goals > s.shots) {
      issues.push({
        entity: "SeasonStats",
        id: s.id,
        field: "goals",
        issue: `More goals (${s.goals}) than shots (${s.shots})`,
        severity: "error",
      });
    }
  }

  // ── Goalie Stats Validation ──
  const badGoalieStats = await prisma.goalieStats.findMany({
    where: {
      OR: [
        { savePercentage: { gt: 1.0 } },
        { savePercentage: { lt: 0.7 } },
        { gamesPlayed: { lt: 0 } },
      ],
    },
    select: { id: true, savePercentage: true, gamesPlayed: true },
  });

  for (const g of badGoalieStats) {
    if (g.gamesPlayed < 0)
      issues.push({
        entity: "GoalieStats",
        id: g.id,
        field: "gamesPlayed",
        issue: "Negative games played",
        severity: "error",
        value: String(g.gamesPlayed),
      });
    if (g.savePercentage && Number(g.savePercentage) > 1.0)
      issues.push({
        entity: "GoalieStats",
        id: g.id,
        field: "savePercentage",
        issue: "Save percentage over 1.000",
        severity: "error",
        value: g.savePercentage.toString(),
      });
    if (g.savePercentage && Number(g.savePercentage) < 0.7 && g.gamesPlayed >= 10)
      issues.push({
        entity: "GoalieStats",
        id: g.id,
        field: "savePercentage",
        issue: "Unusually low save percentage (< .700)",
        severity: "warning",
        value: g.savePercentage.toString(),
      });
  }

  // ── Staleness Check ──
  const staleThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const stalePlayers = await prisma.player.count({
    where: {
      isActive: true,
      updatedAt: { lt: staleThreshold },
    },
  });

  if (stalePlayers > 0) {
    issues.push({
      entity: "Player",
      id: "aggregate",
      field: "updatedAt",
      issue: `${stalePlayers} active players not updated in 48+ hours`,
      severity: "warning",
    });
  }

  const lastJob = await prisma.jobRun.findFirst({
    where: { jobName: { contains: "sync" }, status: "completed" },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true },
  });

  // ── Missing Data Checks ──
  const playersWithoutContracts = await prisma.player.count({
    where: {
      isActive: true,
      contracts: { none: {} },
    },
  });

  if (playersWithoutContracts > 0) {
    issues.push({
      entity: "Contract",
      id: "aggregate",
      field: "playerId",
      issue: `${playersWithoutContracts} active players have no contract data`,
      severity: "info",
    });
  }

  const playersWithoutAdvanced = await prisma.player.count({
    where: {
      isActive: true,
      position: { not: "G" },
      advancedStats: { none: {} },
    },
  });

  if (playersWithoutAdvanced > 0) {
    issues.push({
      entity: "AdvancedStats",
      id: "aggregate",
      field: "playerId",
      issue: `${playersWithoutAdvanced} active skaters have no advanced stats`,
      severity: "info",
    });
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalPlayers,
      activePlayers,
      totalSeasonStats,
      totalGoalieStats,
      totalAdvancedStats,
      totalContracts,
      totalIssues: issues.length,
      errors: errorCount,
      warnings: warningCount,
    },
    staleness: {
      playersNotUpdatedIn48h: stalePlayers,
      lastStatSync: lastJob?.completedAt?.toISOString() ?? null,
    },
    issues,
  };
}
