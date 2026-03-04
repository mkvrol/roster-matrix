import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getAge(birthDate: Date | null): number {
  if (!birthDate) return 27;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function getSigningType(age: number, yearsInLeague: number): "RFA" | "UFA" | "ELC" | "EXTENSION" {
  if (yearsInLeague <= 3 && age <= 25) return "ELC";
  if (age < 25) return "RFA";
  if (age >= 27) return "UFA";
  return Math.random() > 0.5 ? "EXTENSION" : "RFA";
}

function getAAV(
  position: string,
  pointsPer82: number,
  age: number,
  signingType: string,
): number {
  if (signingType === "ELC") {
    return rand(0.85, 0.95);
  }

  let baseAAV: number;

  if (position === "G") {
    // Goalies — no direct point correlation, use random tiers
    const tier = Math.random();
    if (tier > 0.85) baseAAV = rand(5.0, 10.5);
    else if (tier > 0.5) baseAAV = rand(2.5, 5.0);
    else baseAAV = rand(0.8, 2.5);
  } else if (position === "D") {
    if (pointsPer82 >= 50) baseAAV = rand(6.5, 11.0);
    else if (pointsPer82 >= 30) baseAAV = rand(3.5, 7.0);
    else if (pointsPer82 >= 15) baseAAV = rand(1.5, 4.0);
    else baseAAV = rand(0.8, 2.0);
  } else {
    // Forwards (C, LW, RW)
    if (pointsPer82 >= 80) baseAAV = rand(9.0, 13.5);
    else if (pointsPer82 >= 60) baseAAV = rand(6.0, 9.5);
    else if (pointsPer82 >= 40) baseAAV = rand(3.5, 6.5);
    else if (pointsPer82 >= 20) baseAAV = rand(1.5, 4.0);
    else baseAAV = rand(0.8, 2.0);
  }

  // RFA discount ~15%
  if (signingType === "RFA") baseAAV *= 0.85;

  // Age premium/discount
  if (age >= 33) baseAAV *= 0.8;
  else if (age >= 30) baseAAV *= 0.9;
  else if (age <= 24) baseAAV *= 0.9;

  return Math.round(baseAAV * 100000) / 100000;
}

function getTerm(age: number, aav: number, signingType: string): number {
  if (signingType === "ELC") return 3;

  if (age >= 35) return Math.random() > 0.5 ? 1 : 2;
  if (age >= 32) return Math.ceil(rand(1, 3));
  if (age >= 28) {
    if (aav > 7) return Math.ceil(rand(5, 8));
    return Math.ceil(rand(2, 5));
  }
  // Young players: bridge or long-term
  if (aav > 6) return Math.ceil(rand(6, 8));
  if (aav > 3) return Math.ceil(rand(3, 6));
  return Math.ceil(rand(1, 3));
}

function getStructure(term: number, aav: number): "FRONT_LOADED" | "BACK_LOADED" | "EVEN" | "FLAT" {
  if (term <= 2) return "FLAT";
  if (aav > 8 && term >= 6) {
    const r = Math.random();
    if (r > 0.6) return "FRONT_LOADED";
    if (r > 0.3) return "EVEN";
    return "FLAT";
  }
  return Math.random() > 0.4 ? "FLAT" : "EVEN";
}

function buildCapHitByYear(
  aav: number,
  term: number,
  structure: string,
  startYear: number,
): Record<string, number> {
  const hits: Record<string, number> = {};
  for (let i = 0; i < term; i++) {
    const year = `${startYear + i}-${String(startYear + i + 1).slice(2)}`;
    let hit = aav;
    if (structure === "FRONT_LOADED" && term > 2) {
      const factor = 1 + 0.15 * (1 - (2 * i) / (term - 1));
      hit = aav * factor;
    } else if (structure === "BACK_LOADED" && term > 2) {
      const factor = 1 - 0.1 * (1 - (2 * i) / (term - 1));
      hit = aav * factor;
    }
    hits[year] = Math.round(hit * 1000000) / 1000000;
  }
  return hits;
}

export interface ContractSeedResult {
  created: number;
  skipped: number;
  errors: number;
  details: string[];
}

export async function seedContracts(): Promise<ContractSeedResult> {
  const result: ContractSeedResult = {
    created: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  const players = await prisma.player.findMany({
    where: {
      isActive: true,
      currentTeamId: { not: null },
    },
    include: {
      contracts: { select: { id: true }, take: 1 },
      seasonStats: {
        orderBy: { season: "desc" },
        take: 1,
      },
    },
  });

  console.log(
    `[Contract Seed] Generating contracts for ${players.length} active players...`,
  );

  for (const player of players) {
    try {
      if (player.contracts.length > 0) {
        result.skipped++;
        continue;
      }

      const age = getAge(player.birthDate);
      const latestStats = player.seasonStats[0];
      const gp = latestStats?.gamesPlayed ?? 40;
      const points = latestStats?.points ?? 10;
      const pointsPer82 = gp > 0 ? (points / gp) * 82 : 10;

      // Estimate years in league from age (rough)
      const yearsInLeague = Math.max(1, age - 20);
      const signingType = getSigningType(age, yearsInLeague);
      const aav = getAAV(player.position, pointsPer82, age, signingType);
      const term = getTerm(age, aav, signingType);
      const structure = getStructure(term, aav);

      const startYear = 2025 - Math.floor(rand(0, Math.min(term - 1, 2)));
      const endYear = startYear + term;

      const capHitByYear = buildCapHitByYear(aav, term, structure, startYear);
      const totalValue = aav * term;

      const hasNTC = aav >= 5 && term >= 4 && Math.random() > 0.3;
      const hasNMC = aav >= 8 && term >= 5 && Math.random() > 0.4;
      let tradeProtection: string | null = null;
      if (hasNMC && hasNTC) tradeProtection = "Full NMC, NTC in final years";
      else if (hasNMC) tradeProtection = "Full NMC";
      else if (hasNTC) tradeProtection = `Modified NTC (${Math.ceil(rand(5, 15))}-team no-trade list)`;

      await prisma.contract.create({
        data: {
          playerId: player.id,
          teamId: player.currentTeamId!,
          startYear,
          endYear,
          totalYears: term,
          aav: new Prisma.Decimal(Math.round(aav * 1000000) / 1000000),
          totalValue: new Prisma.Decimal(
            Math.round(totalValue * 1000000) / 1000000,
          ),
          structure,
          capHitByYear,
          signingAge: age - Math.floor(rand(0, 2)),
          hasNTC,
          hasNMC,
          tradeProtectionDetails: tradeProtection,
          signingType,
          source: "generated-seed",
        },
      });

      result.created++;
    } catch (error) {
      result.errors++;
      result.details.push(
        `Error for ${player.fullName}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  console.log(
    `[Contract Seed] Done: ${result.created} created, ${result.skipped} skipped, ${result.errors} errors`,
  );
  return result;
}
