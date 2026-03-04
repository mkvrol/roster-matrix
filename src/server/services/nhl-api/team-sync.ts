import { prisma } from "@/lib/prisma";
import { NHL_TEAM_ID_MAP } from "@/lib/nhl-api-types";
import { nhlClient } from "./nhl-client";

export interface TeamSyncResult {
  synced: number;
  errors: number;
  details: string[];
}

export async function syncTeams(): Promise<TeamSyncResult> {
  const result: TeamSyncResult = { synced: 0, errors: 0, details: [] };

  console.log("[Team Sync] Fetching standings...");
  const standings = await nhlClient.getStandings();

  // Deduplicate by abbreviation (standings may list teams multiple times)
  const seen = new Set<string>();
  const uniqueTeams = standings.standings.filter((t) => {
    const abbrev = t.teamAbbrev.default;
    if (seen.has(abbrev)) return false;
    seen.add(abbrev);
    return true;
  });

  console.log(`[Team Sync] Processing ${uniqueTeams.length} teams...`);

  for (const team of uniqueTeams) {
    const abbrev = team.teamAbbrev.default;
    try {
      const nhlApiId = NHL_TEAM_ID_MAP[abbrev];
      if (!nhlApiId) {
        console.warn(`[Team Sync] Unknown abbreviation: ${abbrev}, skipping`);
        result.errors++;
        result.details.push(`Unknown abbreviation: ${abbrev}`);
        continue;
      }

      await prisma.team.upsert({
        where: { abbreviation: abbrev },
        create: {
          nhlApiId,
          name: team.teamName.default,
          abbreviation: abbrev,
          city: team.placeName.default,
          division: team.divisionName,
          conference: team.conferenceName,
          logoUrl: team.teamLogo ?? null,
        },
        update: {
          name: team.teamName.default,
          city: team.placeName.default,
          division: team.divisionName,
          conference: team.conferenceName,
          logoUrl: team.teamLogo ?? null,
        },
      });

      result.synced++;
    } catch (error) {
      result.errors++;
      const msg = `Failed to sync ${abbrev}: ${error instanceof Error ? error.message : error}`;
      result.details.push(msg);
      console.error(`[Team Sync] ${msg}`);
    }
  }

  console.log(
    `[Team Sync] Complete: ${result.synced} synced, ${result.errors} errors`,
  );
  return result;
}
