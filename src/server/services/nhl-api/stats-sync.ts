import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { NHLSeasonTotal } from "@/lib/nhl-api-types";
import { nhlClient } from "./nhl-client";

export interface StatsSyncResult {
  skaterStats: number;
  goalieStats: number;
  errors: number;
  skipped: number;
  details: string[];
}

function formatSeason(seasonId: number): string {
  const startYear = Math.floor(seasonId / 10000);
  const endYear = seasonId % 10000;
  return `${startYear}-${String(endYear).slice(2)}`;
}

function parseToiMinutes(toi: string | undefined | null): number | null {
  if (!toi) return null;
  const parts = toi.split(":");
  if (parts.length !== 2) return null;
  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);
  if (isNaN(minutes) || isNaN(seconds)) return null;
  return Math.round((minutes + seconds / 60) * 100) / 100;
}

function dec(value: number | undefined | null): Prisma.Decimal | null {
  if (value === undefined || value === null) return null;
  return new Prisma.Decimal(value);
}

async function findTeamIdByName(
  teamName: string,
  teamCache: Map<string, string>,
): Promise<string | null> {
  if (teamCache.has(teamName)) return teamCache.get(teamName)!;

  const team = await prisma.team.findFirst({
    where: {
      OR: [
        { name: teamName },
        { name: { contains: teamName.split(" ").pop() ?? "" } },
      ],
    },
    select: { id: true },
  });

  if (team) {
    teamCache.set(teamName, team.id);
  }
  return team?.id ?? null;
}

function isGoalie(player: { position: string }): boolean {
  return player.position === "G";
}

async function syncPlayerStats(
  player: { id: string; nhlApiId: number; position: string },
  currentSeasonOnly: boolean,
  teamCache: Map<string, string>,
  result: StatsSyncResult,
): Promise<void> {
  let landing;
  try {
    landing = await nhlClient.getPlayerLanding(player.nhlApiId);
  } catch (error) {
    result.errors++;
    result.details.push(
      `Failed to fetch landing for ${player.nhlApiId}: ${error instanceof Error ? error.message : error}`,
    );
    return;
  }

  if (!landing.seasonTotals || !Array.isArray(landing.seasonTotals)) {
    console.warn(
      `[Stats Sync] No seasonTotals for player ${player.nhlApiId}, unexpected response shape`,
    );
    result.skipped++;
    return;
  }

  // Update headshot URL from landing data if available
  if (landing.headshot) {
    await prisma.player.update({
      where: { id: player.id },
      data: { headshotUrl: landing.headshot },
    });
  }

  // Filter to NHL regular season entries only
  let nhlSeasons = landing.seasonTotals.filter(
    (s: NHLSeasonTotal) =>
      s.leagueAbbrev === "NHL" && s.gameTypeId === 2,
  );

  if (currentSeasonOnly) {
    const maxSeason = Math.max(...nhlSeasons.map((s) => s.season));
    nhlSeasons = nhlSeasons.filter((s) => s.season === maxSeason);
  }

  for (const season of nhlSeasons) {
    try {
      const seasonStr = formatSeason(season.season);
      const teamName = season.teamName?.default;
      const teamId = teamName
        ? await findTeamIdByName(teamName, teamCache)
        : null;

      if (isGoalie(player)) {
        const saves =
          season.shotsAgainst != null && season.goalsAgainst != null
            ? season.shotsAgainst - season.goalsAgainst
            : 0;

        await prisma.goalieStats.upsert({
          where: {
            playerId_season: {
              playerId: player.id,
              season: seasonStr,
            },
          },
          create: {
            playerId: player.id,
            season: seasonStr,
            teamId,
            gamesPlayed: season.gamesPlayed ?? 0,
            gamesStarted: season.gamesStarted ?? 0,
            wins: season.wins ?? 0,
            losses: season.losses ?? 0,
            otLosses: season.otLosses ?? 0,
            savePercentage: dec(season.savePctg),
            goalsAgainstAvg: dec(season.goalsAgainstAvg),
            shotsAgainst: season.shotsAgainst ?? 0,
            saves,
            shutouts: season.shutouts ?? 0,
          },
          update: {
            teamId,
            gamesPlayed: season.gamesPlayed ?? 0,
            gamesStarted: season.gamesStarted ?? 0,
            wins: season.wins ?? 0,
            losses: season.losses ?? 0,
            otLosses: season.otLosses ?? 0,
            savePercentage: dec(season.savePctg),
            goalsAgainstAvg: dec(season.goalsAgainstAvg),
            shotsAgainst: season.shotsAgainst ?? 0,
            saves,
            shutouts: season.shutouts ?? 0,
          },
        });

        result.goalieStats++;
      } else {
        const toiMinutes = parseToiMinutes(season.avgToi);
        const ppGoals = season.powerPlayGoals ?? 0;
        const ppPoints = season.powerPlayPoints ?? 0;
        const ppAssists = ppPoints - ppGoals;
        const shGoals = season.shorthandedGoals ?? 0;
        const shPoints = season.shorthandedPoints ?? 0;
        const shAssists = shPoints - shGoals;
        const goals = season.goals ?? 0;
        const assists = season.assists ?? 0;
        const esGoals = goals - ppGoals - shGoals;
        const esAssists = assists - ppAssists - shAssists;
        const esPoints = esGoals + esAssists;

        await prisma.seasonStats.upsert({
          where: {
            playerId_season: {
              playerId: player.id,
              season: seasonStr,
            },
          },
          create: {
            playerId: player.id,
            season: seasonStr,
            teamId,
            gamesPlayed: season.gamesPlayed ?? 0,
            goals,
            assists,
            points: season.points ?? 0,
            plusMinus: season.plusMinus ?? 0,
            pim: season.pim ?? 0,
            toiPerGame: toiMinutes != null ? dec(toiMinutes) : null,
            shots: season.shots ?? 0,
            shootingPct: dec(
              season.shootingPctg != null
                ? Math.round(season.shootingPctg * 10000) / 100
                : null,
            ),
            gameWinningGoals: season.gameWinningGoals ?? 0,
            overtimeGoals: season.otGoals ?? 0,
            powerPlayGoals: ppGoals,
            powerPlayAssists: Math.max(ppAssists, 0),
            powerPlayPoints: ppPoints,
            shortHandedGoals: shGoals,
            shortHandedAssists: Math.max(shAssists, 0),
            shortHandedPoints: shPoints,
            evenStrengthGoals: Math.max(esGoals, 0),
            evenStrengthAssists: Math.max(esAssists, 0),
            evenStrengthPoints: Math.max(esPoints, 0),
            faceoffPct: dec(
              season.faceoffWinningPctg != null
                ? Math.round(season.faceoffWinningPctg * 10000) / 100
                : null,
            ),
          },
          update: {
            teamId,
            gamesPlayed: season.gamesPlayed ?? 0,
            goals,
            assists,
            points: season.points ?? 0,
            plusMinus: season.plusMinus ?? 0,
            pim: season.pim ?? 0,
            toiPerGame: toiMinutes != null ? dec(toiMinutes) : null,
            shots: season.shots ?? 0,
            shootingPct: dec(
              season.shootingPctg != null
                ? Math.round(season.shootingPctg * 10000) / 100
                : null,
            ),
            gameWinningGoals: season.gameWinningGoals ?? 0,
            overtimeGoals: season.otGoals ?? 0,
            powerPlayGoals: ppGoals,
            powerPlayAssists: Math.max(ppAssists, 0),
            powerPlayPoints: ppPoints,
            shortHandedGoals: shGoals,
            shortHandedAssists: Math.max(shAssists, 0),
            shortHandedPoints: shPoints,
            evenStrengthGoals: Math.max(esGoals, 0),
            evenStrengthAssists: Math.max(esAssists, 0),
            evenStrengthPoints: Math.max(esPoints, 0),
            faceoffPct: dec(
              season.faceoffWinningPctg != null
                ? Math.round(season.faceoffWinningPctg * 10000) / 100
                : null,
            ),
          },
        });

        result.skaterStats++;
      }
    } catch (error) {
      result.errors++;
      const msg = `Stats error for player ${player.nhlApiId} season ${season.season}: ${error instanceof Error ? error.message : error}`;
      result.details.push(msg);
      console.error(`[Stats Sync] ${msg}`);
    }
  }
}

export async function syncStats(
  currentSeasonOnly = false,
): Promise<StatsSyncResult> {
  const result: StatsSyncResult = {
    skaterStats: 0,
    goalieStats: 0,
    errors: 0,
    skipped: 0,
    details: [],
  };

  const players = await prisma.player.findMany({
    where: { isActive: true },
    select: { id: true, nhlApiId: true, position: true },
  });

  console.log(
    `[Stats Sync] Syncing stats for ${players.length} active players (currentSeasonOnly=${currentSeasonOnly})...`,
  );

  const teamCache = new Map<string, string>();

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    if ((i + 1) % 50 === 0 || i === 0) {
      console.log(`[Stats Sync] Progress: ${i + 1}/${players.length}`);
    }
    await syncPlayerStats(player, currentSeasonOnly, teamCache, result);
  }

  console.log(
    `[Stats Sync] Complete: ${result.skaterStats} skater seasons, ${result.goalieStats} goalie seasons, ${result.errors} errors`,
  );
  return result;
}
