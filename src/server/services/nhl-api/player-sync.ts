import type { Position } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { NHLRosterPlayer } from "@/lib/nhl-api-types";
import { nhlClient } from "./nhl-client";

export interface PlayerSyncResult {
  synced: number;
  errors: number;
  skipped: number;
  details: string[];
}

function mapPosition(positionCode: string): Position {
  switch (positionCode) {
    case "C":
      return "C";
    case "L":
      return "LW";
    case "R":
      return "RW";
    case "D":
      return "D";
    case "G":
      return "G";
    default:
      console.warn(`[Player Sync] Unknown position code: ${positionCode}, defaulting to C`);
      return "C";
  }
}

function parseBirthDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

async function syncTeamRoster(
  teamAbbrev: string,
  teamDbId: string,
  result: PlayerSyncResult,
): Promise<void> {
  let roster;
  try {
    roster = await nhlClient.getRoster(teamAbbrev);
  } catch (error) {
    const msg = `Failed to fetch roster for ${teamAbbrev}: ${error instanceof Error ? error.message : error}`;
    result.details.push(msg);
    console.error(`[Player Sync] ${msg}`);
    result.errors++;
    return;
  }

  const allPlayers: NHLRosterPlayer[] = [
    ...(roster.forwards ?? []),
    ...(roster.defensemen ?? []),
    ...(roster.goalies ?? []),
  ];

  for (const player of allPlayers) {
    try {
      if (!player.id) {
        result.skipped++;
        continue;
      }

      const firstName = player.firstName?.default ?? "Unknown";
      const lastName = player.lastName?.default ?? "Unknown";

      await prisma.player.upsert({
        where: { nhlApiId: player.id },
        create: {
          nhlApiId: player.id,
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`,
          position: mapPosition(player.positionCode),
          shootsCatches: player.shootsCatches ?? null,
          birthDate: parseBirthDate(player.birthDate),
          birthCity: player.birthCity?.default ?? null,
          birthCountry: player.birthCountry ?? null,
          heightInches: player.heightInInches ?? null,
          weightLbs: player.weightInPounds ?? null,
          isActive: true,
          headshotUrl: player.headshot ?? null,
          currentTeamId: teamDbId,
        },
        update: {
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`,
          position: mapPosition(player.positionCode),
          shootsCatches: player.shootsCatches ?? null,
          birthDate: parseBirthDate(player.birthDate),
          birthCity: player.birthCity?.default ?? null,
          birthCountry: player.birthCountry ?? null,
          heightInches: player.heightInInches ?? null,
          weightLbs: player.weightInPounds ?? null,
          isActive: true,
          headshotUrl: player.headshot ?? null,
          currentTeamId: teamDbId,
        },
      });

      result.synced++;
    } catch (error) {
      result.errors++;
      const msg = `Failed to sync player ${player.id} (${player.firstName?.default} ${player.lastName?.default}): ${error instanceof Error ? error.message : error}`;
      result.details.push(msg);
      console.error(`[Player Sync] ${msg}`);
    }
  }
}

export async function syncPlayers(): Promise<PlayerSyncResult> {
  const result: PlayerSyncResult = {
    synced: 0,
    errors: 0,
    skipped: 0,
    details: [],
  };

  const teams = await prisma.team.findMany({
    select: { id: true, abbreviation: true },
  });

  console.log(`[Player Sync] Syncing rosters for ${teams.length} teams...`);

  for (const team of teams) {
    console.log(`[Player Sync] Fetching roster: ${team.abbreviation}`);
    await syncTeamRoster(team.abbreviation, team.id, result);
  }

  console.log(
    `[Player Sync] Complete: ${result.synced} synced, ${result.errors} errors, ${result.skipped} skipped`,
  );
  return result;
}
