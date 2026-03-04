import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function gaussRand(mean: number, stddev: number): number {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stddev;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function dec(val: number): Prisma.Decimal {
  return new Prisma.Decimal(Math.round(val * 10000) / 10000);
}

export interface AdvancedStatsSeedResult {
  created: number;
  skipped: number;
  errors: number;
  details: string[];
}

export async function seedAdvancedStats(): Promise<AdvancedStatsSeedResult> {
  const result: AdvancedStatsSeedResult = {
    created: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  const seasonStats = await prisma.seasonStats.findMany({
    include: {
      player: { select: { id: true, position: true } },
    },
  });

  console.log(
    `[Advanced Stats Seed] Generating for ${seasonStats.length} player-seasons...`,
  );

  for (const stats of seasonStats) {
    try {
      const existing = await prisma.advancedStats.findUnique({
        where: {
          playerId_season: {
            playerId: stats.playerId,
            season: stats.season,
          },
        },
      });

      if (existing) {
        result.skipped++;
        continue;
      }

      const gp = stats.gamesPlayed || 1;
      const goals = stats.goals;
      const shots = stats.shots || 1;
      const points = stats.points;
      const plusMinus = stats.plusMinus;
      const toi = stats.toiPerGame ? Number(stats.toiPerGame) : 16;
      const isDefenseman = stats.player.position === "D";

      // Corsi: shot attempts correlate with TOI and shots
      const shotsPerGame = shots / gp;
      const cfPerGame = shotsPerGame * rand(2.2, 2.8);
      const corsiFor = Math.round(cfPerGame * gp * 100) / 100;

      // Better players have higher CF%
      const pointsPer82 = (points / gp) * 82;
      const cfPctBase = isDefenseman ? 49.5 : 50.0;
      const cfPctBonus = clamp((pointsPer82 - 40) * 0.08, -4, 4);
      const corsiForPct = clamp(
        gaussRand(cfPctBase + cfPctBonus, 2.5),
        42,
        62,
      );
      const corsiAgainst =
        Math.round((corsiFor * (100 - corsiForPct)) / corsiForPct * 100) / 100;

      const fenwickForPct = clamp(
        corsiForPct + gaussRand(0, 0.8),
        42,
        62,
      );

      // Expected goals
      const shootingQuality = goals / shots;
      const ixG =
        Math.round(
          shots * clamp(shootingQuality * rand(0.8, 1.2), 0.06, 0.2) * 100,
        ) / 100;
      const xGF =
        Math.round(ixG * rand(1.3, 1.8) * 100) / 100;
      const xGFPctBase = corsiForPct + gaussRand(0, 2);
      const xGFPct = clamp(xGFPctBase, 38, 65);
      const xGA =
        Math.round((xGF * (100 - xGFPct)) / xGFPct * 100) / 100;

      // Goals for %
      const gfPct = clamp(
        50 + plusMinus / gp * 15 + gaussRand(0, 5),
        30,
        75,
      );

      // Zone starts
      const ozBase = isDefenseman ? 45 : 52;
      const ozBonus = clamp((pointsPer82 - 40) * 0.15, -8, 10);
      const ozPct = clamp(gaussRand(ozBase + ozBonus, 5), 25, 75);
      const dzPct = 100 - ozPct;

      // iHDCF correlates with goals
      const iHDCF = Math.max(
        5,
        Math.round(goals * rand(1.5, 3.0) + gp * rand(0.2, 0.5)),
      );

      // On-ice percentages
      const onIceSh = clamp(gaussRand(9.0, 1.5), 5, 15);
      const onIceSv = clamp(gaussRand(0.915, 0.008), 0.88, 0.95);

      // PDO = on-ice shooting% + on-ice save% (as %, so ~100)
      const pdo = clamp(onIceSh + onIceSv * 100, 96, 105);

      // Relative stats
      const relCF = clamp(corsiForPct - 50 + gaussRand(0, 1), -8, 8);
      const relXGF = clamp(xGFPct - 50 + gaussRand(0, 1.2), -7, 7);

      await prisma.advancedStats.create({
        data: {
          playerId: stats.playerId,
          season: stats.season,
          teamId: stats.teamId,
          corsiFor: dec(corsiFor),
          corsiAgainst: dec(corsiAgainst),
          corsiForPct: dec(corsiForPct),
          fenwickForPct: dec(fenwickForPct),
          expectedGoalsFor: dec(xGF),
          expectedGoalsAgainst: dec(xGA),
          xGFPct: dec(xGFPct),
          goalsForPct: dec(gfPct),
          offensiveZoneStartPct: dec(ozPct),
          defensiveZoneStartPct: dec(dzPct),
          individualExpectedGoals: dec(ixG),
          individualHighDangerChances: iHDCF,
          onIceShootingPct: dec(onIceSh),
          onIceSavePct: dec(onIceSv),
          pdo: dec(pdo),
          relCorsiForPct: dec(relCF),
          relXGFPct: dec(relXGF),
        },
      });

      result.created++;
    } catch (error) {
      result.errors++;
      result.details.push(
        `Error for ${stats.playerId}/${stats.season}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  console.log(
    `[Advanced Stats Seed] Done: ${result.created} created, ${result.skipped} skipped, ${result.errors} errors`,
  );
  return result;
}
