// ──────────────────────────────────────────────
// Roster Matrix — Peer Comparison
// Find comparable contracts and rank value
// ──────────────────────────────────────────────

import type { PrismaClient } from "@prisma/client";
import type {
  Position,
  PeerContract,
  PeerComparisonResult,
  ValueInput,
} from "./index";
import { getPositionGroup, calculateValueScore } from "./index";

interface FindPeersOptions {
  aavTolerancePct?: number; // default 20 (±20% of AAV)
  ageToleranceYears?: number; // default 3 (±3 years)
  maxResults?: number; // default 20
  season?: string; // default latest
}

export async function findComparableContracts(
  input: ValueInput,
  prisma: PrismaClient,
  options: FindPeersOptions = {},
): Promise<PeerComparisonResult> {
  const {
    aavTolerancePct = 20,
    ageToleranceYears = 3,
    maxResults = 20,
    season,
  } = options;

  const posGroup = getPositionGroup(input.player.position);
  const positions = positionsInGroup(posGroup);
  const age = resolveAge(input.player.birthDate, input.player.age);
  const aav = input.contract.aav;
  const aavLow = aav * (1 - aavTolerancePct / 100);
  const aavHigh = aav * (1 + aavTolerancePct / 100);

  // Find the most recent season available if not specified
  const targetSeason =
    season ??
    (
      await prisma.seasonStats.findFirst({
        orderBy: { season: "desc" },
        select: { season: true },
      })
    )?.season ??
    "20242025";

  // Query comparable players
  const players = await prisma.player.findMany({
    where: {
      isActive: true,
      position: { in: positions },
      contracts: {
        some: {
          aav: { gte: aavLow, lte: aavHigh },
        },
      },
    },
    include: {
      contracts: {
        orderBy: { startYear: "desc" },
        take: 1,
      },
      seasonStats: {
        where: { season: targetSeason },
        take: 1,
      },
      goalieStats: posGroup === "G"
        ? { where: { season: targetSeason }, take: 1 }
        : undefined,
      advancedStats: {
        where: { season: targetSeason },
        take: 1,
      },
    },
  });

  // Filter by age and compute value scores
  const peers: PeerContract[] = [];
  for (const p of players) {
    const playerAge = getAgeFromBirthDate(p.birthDate);
    if (Math.abs(playerAge - age) > ageToleranceYears) continue;

    const contract = p.contracts[0];
    if (!contract) continue;

    const stats = p.seasonStats[0];
    const goalie = p.goalieStats?.[0];
    const advanced = p.advancedStats?.[0];

    // Build ValueInput for this peer
    const peerInput: ValueInput = {
      player: { position: p.position as Position, age: playerAge },
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
      peerInput.goalie = {
        gamesPlayed: goalie.gamesPlayed,
        gamesStarted: goalie.gamesStarted,
        wins: goalie.wins,
        losses: goalie.losses,
        otLosses: goalie.otLosses,
        savePercentage: Number(goalie.savePercentage ?? 0.900),
        goalsAgainstAvg: Number(goalie.goalsAgainstAvg ?? 3.0),
        shotsAgainst: goalie.shotsAgainst,
        saves: goalie.saves,
        shutouts: goalie.shutouts,
        qualityStarts: goalie.qualityStarts ?? undefined,
        qualityStartPct: goalie.qualityStartPct ? Number(goalie.qualityStartPct) : undefined,
        goalsAboveExpected: goalie.goalsAboveExpected ? Number(goalie.goalsAboveExpected) : undefined,
        highDangerSavePct: goalie.highDangerSavePct ? Number(goalie.highDangerSavePct) : undefined,
      };
    } else if (stats) {
      peerInput.stats = {
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
        powerPlayToi: stats.powerPlayToi ? Number(stats.powerPlayToi) : undefined,
        shortHandedGoals: stats.shortHandedGoals,
        shortHandedAssists: stats.shortHandedAssists,
        shortHandedPoints: stats.shortHandedPoints,
        shortHandedToi: stats.shortHandedToi ? Number(stats.shortHandedToi) : undefined,
        evenStrengthGoals: stats.evenStrengthGoals,
        evenStrengthAssists: stats.evenStrengthAssists,
        evenStrengthPoints: stats.evenStrengthPoints,
      };
      if (advanced) {
        peerInput.advanced = {
          corsiForPct: advanced.corsiForPct ? Number(advanced.corsiForPct) : undefined,
          xGFPct: advanced.xGFPct ? Number(advanced.xGFPct) : undefined,
          goalsForPct: advanced.goalsForPct ? Number(advanced.goalsForPct) : undefined,
          relCorsiForPct: advanced.relCorsiForPct ? Number(advanced.relCorsiForPct) : undefined,
          individualExpectedGoals: advanced.individualExpectedGoals ? Number(advanced.individualExpectedGoals) : undefined,
          individualHighDangerChances: advanced.individualHighDangerChances ?? undefined,
        };
      }
    } else {
      continue; // Skip players without stats
    }

    let valueScore: number;
    try {
      valueScore = calculateValueScore(peerInput).overall;
    } catch {
      continue;
    }

    peers.push({
      playerId: p.id,
      playerName: p.fullName,
      position: p.position as Position,
      age: playerAge,
      aav: Number(contract.aav),
      totalYears: contract.totalYears,
      valueScore,
      points: stats?.points ?? 0,
      gamesPlayed: stats?.gamesPlayed ?? goalie?.gamesPlayed ?? 0,
    });
  }

  // Sort by value score descending
  peers.sort((a, b) => b.valueScore - a.valueScore);
  const trimmed = peers.slice(0, maxResults);

  // Compute subject's own score
  const subjectScore = calculateValueScore(input).overall;
  const subjectEntry: PeerContract = {
    playerId: "",
    playerName: "Subject",
    position: input.player.position,
    age,
    aav: input.contract.aav,
    totalYears: input.contract.totalYears,
    valueScore: subjectScore,
    points: input.stats?.points ?? 0,
    gamesPlayed: input.stats?.gamesPlayed ?? input.goalie?.gamesPlayed ?? 0,
  };

  // Rank subject among peers
  const allScored = [...trimmed, subjectEntry].sort(
    (a, b) => b.valueScore - a.valueScore,
  );
  const rank = allScored.findIndex((p) => p.playerId === "") + 1;
  const percentile =
    trimmed.length > 0
      ? Math.round(((trimmed.length - rank + 1) / (trimmed.length + 1)) * 100)
      : 50;

  const summary = buildSummary(subjectScore, rank, trimmed.length + 1, percentile);

  return {
    player: subjectEntry,
    peers: trimmed,
    rank,
    percentile,
    summary,
  };
}

// ── Helpers ──

function positionsInGroup(group: "F" | "D" | "G"): Position[] {
  switch (group) {
    case "F": return ["C", "LW", "RW"];
    case "D": return ["D"];
    case "G": return ["G"];
  }
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

function resolveAge(birthDate?: Date | string, age?: number): number {
  if (age != null) return age;
  if (!birthDate) return 27;
  const bd = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  return getAgeFromBirthDate(bd);
}

function buildSummary(
  score: number,
  rank: number,
  total: number,
  percentile: number,
): string {
  const ordinal =
    rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `${rank}th`;
  if (percentile >= 80) {
    return `Ranks ${ordinal} of ${total} comparable contracts (${percentile}th percentile). Outstanding value relative to peers.`;
  }
  if (percentile >= 60) {
    return `Ranks ${ordinal} of ${total} comparable contracts (${percentile}th percentile). Above-average value among peers.`;
  }
  if (percentile >= 40) {
    return `Ranks ${ordinal} of ${total} comparable contracts (${percentile}th percentile). Producing at fair market value.`;
  }
  return `Ranks ${ordinal} of ${total} comparable contracts (${percentile}th percentile). Below expected production for this contract tier.`;
}
