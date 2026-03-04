import { Prisma, ContractStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import contractsLookup from "../../../prisma/contracts-lookup.json";

const CURRENT_SEASON_START = 2025;
const CURRENT_SEASON_END = 2026;

function deriveContractStatus(startYear: number, endYear: number): ContractStatus {
  if (startYear > CURRENT_SEASON_START) return "FUTURE";
  if (endYear < CURRENT_SEASON_END) return "EXPIRED";
  return "ACTIVE";
}

interface LookupEntry {
  name: string;
  capHit: number;
  endYear: number;
  startYear?: number;
  status: "UFA" | "RFA";
}

interface ContractLookup {
  lastUpdated: string;
  season: string;
  teams: Record<string, LookupEntry[]>;
}

export interface ContractSyncResult {
  matched: number;
  unmatched: number;
  errors: number;
  details: string[];
}

function buildCapHitByYear(
  aav: number,
  startYear: number,
  endYear: number,
): Record<string, number> {
  const hits: Record<string, number> = {};
  for (let y = startYear; y < endYear; y++) {
    const label = `${y}-${String(y + 1).slice(2)}`;
    hits[label] = aav;
  }
  return hits;
}

function deriveSigningType(
  status: "UFA" | "RFA",
  age: number,
): "UFA" | "RFA" | "ELC" | "EXTENSION" {
  if (age <= 22) return "ELC";
  if (status === "RFA") return "RFA";
  return "UFA";
}

export function lookupPlayerContracts(
  fullName: string,
  teamAbbrev: string,
): LookupEntry[] {
  const lookup = contractsLookup as ContractLookup;
  const teamPlayers = lookup.teams[teamAbbrev];
  if (!teamPlayers) return [];

  const normalized = fullName.toLowerCase().trim();
  return teamPlayers.filter((p) => p.name.toLowerCase().trim() === normalized);
}

export function lookupPlayerContract(
  fullName: string,
  teamAbbrev: string,
): LookupEntry | null {
  return lookupPlayerContracts(fullName, teamAbbrev)[0] ?? null;
}

export async function syncContracts(): Promise<ContractSyncResult> {
  const result: ContractSyncResult = {
    matched: 0,
    unmatched: 0,
    errors: 0,
    details: [],
  };

  const players = await prisma.player.findMany({
    where: {
      isActive: true,
      currentTeamId: { not: null },
    },
    include: {
      currentTeam: { select: { abbreviation: true } },
      contracts: { select: { id: true }, take: 1 },
    },
  });

  for (const player of players) {
    if (player.contracts.length > 0) continue;

    const teamAbbrev = player.currentTeam?.abbreviation;
    if (!teamAbbrev) {
      result.unmatched++;
      continue;
    }

    const entries = lookupPlayerContracts(player.fullName, teamAbbrev);
    if (entries.length === 0) {
      result.unmatched++;
      result.details.push(`No match: ${player.fullName} (${teamAbbrev})`);
      continue;
    }

    for (const entry of entries) {
      try {
        const totalYears = entry.startYear
          ? entry.endYear - entry.startYear
          : entry.endYear - 2025;
        const startYear = entry.startYear ?? entry.endYear - Math.max(1, totalYears);
        const age =
          player.birthDate
            ? new Date().getFullYear() - player.birthDate.getFullYear()
            : 27;
        const signingType = deriveSigningType(entry.status, age);
        const hasNTC =
          entry.capHit >= 5_000_000 && totalYears >= 4;
        const hasNMC =
          entry.capHit >= 8_000_000 && totalYears >= 5;
        const structure = totalYears <= 2 ? "FLAT" : "EVEN";

        await prisma.contract.create({
          data: {
            playerId: player.id,
            teamId: player.currentTeamId!,
            startYear,
            endYear: entry.endYear,
            totalYears: Math.max(1, totalYears),
            aav: new Prisma.Decimal(entry.capHit),
            totalValue: new Prisma.Decimal(
              entry.capHit * Math.max(1, totalYears),
            ),
            structure,
            capHitByYear: buildCapHitByYear(entry.capHit, startYear, entry.endYear),
            signingAge: age,
            hasNTC,
            hasNMC,
            signingType,
            status: deriveContractStatus(startYear, entry.endYear),
            source: "puckpedia",
          },
        });

        result.matched++;
      } catch (error) {
        result.errors++;
        result.details.push(
          `Error for ${player.fullName}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }

  return result;
}
