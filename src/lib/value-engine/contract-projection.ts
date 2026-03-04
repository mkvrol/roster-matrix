// ──────────────────────────────────────────────
// Roster Matrix — Contract Projection
// Project a player's next contract based on
// production, age, comparables, and market trends
// ──────────────────────────────────────────────

import type { PrismaClient } from "@prisma/client";
import type {
  Position,
  ValueInput,
  ProjectedContract,
} from "./index";
import { getPositionGroup } from "./index";

// ── Salary cap inflation factor ──
// The NHL salary cap has grown ~3% per year on average since the 2020 flat cap era ended.
// Project forward using a modest growth rate.
const CAP_GROWTH_RATE = 0.035; // 3.5% per year
const CURRENT_CAP = 95_500_000; // 2025-26 cap

function inflationMultiplier(yearsOut: number): number {
  return Math.pow(1 + CAP_GROWTH_RATE, yearsOut);
}

// ── Position multipliers for AAV ──
// Relative cap share by position (based on historical averages)
const POSITION_CAP_SHARE: Record<string, number> = {
  C: 1.0,
  LW: 0.92,
  RW: 0.92,
  D: 0.88,
  G: 0.78,
};

// ── Age-at-signing impact on term ──
function maxTermForAge(age: number): number {
  if (age <= 25) return 8;
  if (age <= 27) return 8;
  if (age <= 29) return 7;
  if (age <= 31) return 5;
  if (age <= 33) return 3;
  if (age <= 35) return 2;
  return 1;
}

// ── Production-based AAV estimation ──
// Maps points-per-82 to a base AAV range using historical market data.
function baseAAVFromProduction(
  pointsPer82: number,
  position: Position,
): { low: number; mid: number; high: number } {
  const posGroup = getPositionGroup(position);
  const posMult = POSITION_CAP_SHARE[position] ?? 1.0;

  let baseMid: number;
  if (posGroup === "G") {
    // Goalies don't use points; handled separately
    baseMid = 4_000_000;
  } else if (posGroup === "D") {
    if (pointsPer82 >= 60) baseMid = 9_500_000;
    else if (pointsPer82 >= 45) baseMid = 7_500_000;
    else if (pointsPer82 >= 30) baseMid = 5_000_000;
    else if (pointsPer82 >= 18) baseMid = 3_000_000;
    else baseMid = 1_500_000;
  } else {
    // Forwards
    if (pointsPer82 >= 100) baseMid = 13_000_000;
    else if (pointsPer82 >= 80) baseMid = 10_500_000;
    else if (pointsPer82 >= 60) baseMid = 7_500_000;
    else if (pointsPer82 >= 45) baseMid = 5_500_000;
    else if (pointsPer82 >= 30) baseMid = 3_500_000;
    else baseMid = 1_500_000;
  }

  // Apply position multiplier for wings vs centers
  baseMid = baseMid * posMult;

  return {
    low: Math.round(baseMid * 0.82),
    mid: Math.round(baseMid),
    high: Math.round(baseMid * 1.18),
  };
}

// ── Goalie AAV estimation ──
function goalieAAVFromStats(
  svPct: number,
  gamesStarted: number,
): { low: number; mid: number; high: number } {
  let baseMid: number;
  if (svPct >= 0.925 && gamesStarted >= 50) baseMid = 9_000_000;
  else if (svPct >= 0.918 && gamesStarted >= 45) baseMid = 7_000_000;
  else if (svPct >= 0.912 && gamesStarted >= 35) baseMid = 5_000_000;
  else if (svPct >= 0.905) baseMid = 3_500_000;
  else baseMid = 2_000_000;

  return {
    low: Math.round(baseMid * 0.80),
    mid: Math.round(baseMid),
    high: Math.round(baseMid * 1.20),
  };
}

// ── Age discount/premium ──
function ageMultiplier(ageAtSigning: number): number {
  if (ageAtSigning <= 22) return 0.80; // RFA discount
  if (ageAtSigning <= 24) return 0.90; // still RFA-ish
  if (ageAtSigning <= 27) return 1.00; // prime UFA
  if (ageAtSigning <= 29) return 1.02; // peak UFA premium
  if (ageAtSigning <= 31) return 0.92; // slight decline concern
  if (ageAtSigning <= 33) return 0.80;
  return 0.65; // 34+ significant discount
}

// ── Main projection function ──

export async function projectNextContract(
  input: ValueInput,
  prisma: PrismaClient,
): Promise<ProjectedContract> {
  const position = input.player.position;
  const posGroup = getPositionGroup(position);
  const age = resolveAge(input.player.birthDate, input.player.age);
  const ageAtExpiry = age + Math.max(0, input.contract.endYear - 2025);
  const yearsUntilExpiry = Math.max(1, input.contract.endYear - 2025);

  // Calculate current production level
  let pointsPer82 = 0;
  if (input.stats) {
    const gp = Math.max(input.stats.gamesPlayed, 1);
    pointsPer82 = (input.stats.points / gp) * 82;
  }

  // Get base AAV from production
  let aavRange: { low: number; mid: number; high: number };
  if (posGroup === "G" && input.goalie) {
    aavRange = goalieAAVFromStats(input.goalie.savePercentage, input.goalie.gamesStarted);
  } else {
    aavRange = baseAAVFromProduction(pointsPer82, position);
  }

  // Apply age adjustment at time of signing
  const ageMult = ageMultiplier(ageAtExpiry);
  aavRange = {
    low: Math.round(aavRange.low * ageMult),
    mid: Math.round(aavRange.mid * ageMult),
    high: Math.round(aavRange.high * ageMult),
  };

  // Apply market inflation
  const inflation = inflationMultiplier(yearsUntilExpiry);
  aavRange = {
    low: Math.round(aavRange.low * inflation),
    mid: Math.round(aavRange.mid * inflation),
    high: Math.round(aavRange.high * inflation),
  };

  // Term projection
  const maxTerm = maxTermForAge(ageAtExpiry);
  const isElite = pointsPer82 >= 70 || (posGroup === "G" && input.goalie && input.goalie.savePercentage >= 0.920);
  const termMid = isElite ? Math.min(maxTerm, 7) : Math.min(maxTerm, 4);
  const termRange = {
    low: Math.max(1, termMid - 2),
    mid: termMid,
    high: Math.min(8, termMid + 1),
  };

  // Find historical comparables
  const comparables = await findHistoricalComparables(
    prisma, position, pointsPer82, ageAtExpiry, posGroup === "G" ? input.goalie : undefined,
  );

  // Confidence score: higher with more comparables, lower with extreme cases
  const compCount = comparables.length;
  const baseConfidence = Math.min(85, 30 + compCount * 8);
  const ageConfidencePenalty = ageAtExpiry >= 33 ? 15 : ageAtExpiry >= 30 ? 8 : 0;
  const confidence = Math.max(20, baseConfidence - ageConfidencePenalty);

  return {
    projectedAAV: aavRange,
    projectedTerm: termRange,
    confidence,
    comparables,
    factors: {
      currentProduction: Math.round(pointsPer82 * 10) / 10,
      ageAtExpiry,
      positionMultiplier: POSITION_CAP_SHARE[position] ?? 1.0,
      marketInflation: Math.round(inflation * 1000) / 1000,
    },
  };
}

// ── Find historical comparable signings ──

async function findHistoricalComparables(
  prisma: PrismaClient,
  position: Position,
  pointsPer82: number,
  targetAge: number,
  goalie?: { savePercentage: number; gamesStarted: number } | undefined,
): Promise<ProjectedContract["comparables"]> {
  const posGroup = getPositionGroup(position);
  const positions = posGroup === "F" ? ["C", "LW", "RW"] : posGroup === "D" ? ["D"] : ["G"];

  // Query contracts with stats
  const contracts = await prisma.contract.findMany({
    where: {
      player: {
        position: { in: positions as any },
        isActive: true,
      },
      signingAge: {
        gte: Math.max(18, targetAge - 4),
        lte: targetAge + 4,
      },
    },
    include: {
      player: {
        include: {
          seasonStats: {
            orderBy: { season: "desc" },
            take: 1,
          },
          goalieStats: posGroup === "G"
            ? { orderBy: { season: "desc" }, take: 1 }
            : undefined,
        },
      },
    },
    orderBy: { startYear: "desc" },
    take: 50,
  });

  // Score each comparable by similarity to the subject
  const scored: Array<{
    playerName: string;
    aav: number;
    term: number;
    ageAtSigning: number;
    productionAtSigning: number;
    similarity: number;
  }> = [];

  for (const c of contracts) {
    let production = 0;
    if (posGroup === "G") {
      const gs = c.player.goalieStats?.[0];
      if (!gs) continue;
      production = Number(gs.savePercentage ?? 0.900) * 1000; // normalize for comparison
    } else {
      const ss = c.player.seasonStats[0];
      if (!ss) continue;
      const gp = Math.max(ss.gamesPlayed, 1);
      production = (ss.points / gp) * 82;
    }

    const signingAge = c.signingAge ?? targetAge;
    const ageDiff = Math.abs(signingAge - targetAge);
    const prodDiff = Math.abs(production - (posGroup === "G" ? (goalie?.savePercentage ?? 0.910) * 1000 : pointsPer82));

    // Similarity: lower is better
    const similarity = ageDiff * 3 + prodDiff * 0.5;

    scored.push({
      playerName: c.player.fullName,
      aav: Number(c.aav),
      term: c.totalYears,
      ageAtSigning: signingAge,
      productionAtSigning: Math.round(production * 10) / 10,
      similarity,
    });
  }

  // Sort by similarity and take top 5
  scored.sort((a, b) => a.similarity - b.similarity);

  return scored.slice(0, 5).map(({ similarity: _, ...rest }) => rest);
}

// ── Helper ──

function resolveAge(birthDate?: Date | string, age?: number): number {
  if (age != null) return age;
  if (!birthDate) return 27;
  const bd = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
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
