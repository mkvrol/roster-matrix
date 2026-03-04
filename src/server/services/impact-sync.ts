// ──────────────────────────────────────────────
// Impact Stats Sync — Calculates player win impact
// from NHL API game-by-game data
// ──────────────────────────────────────────────

import { PrismaClient, Prisma } from "@prisma/client";

const NHL_API = "https://api-web.nhle.com/v1";

// ── Types ──

interface GameLogEntry {
  gameId: number;
  teamAbbrev: string;
  homeRoadFlag: "H" | "R";
  gameDate: string;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  powerPlayGoals: number;
  gameWinningGoals: number;
  otGoals: number;
  shots: number;
  pim: number;
  toi: string; // "MM:SS"
  opponentAbbrev: string;
}

interface GoalieGameLogEntry {
  gameId: number;
  teamAbbrev: string;
  homeRoadFlag: "H" | "R";
  gameDate: string;
  gamesStarted: number;
  decision: string; // "W", "L", "O"
  shotsAgainst: number;
  goalsAgainst: number;
  savePctg: number;
  shutouts: number;
  toi: string;
  opponentAbbrev: string;
}

interface TeamGameResult {
  gameId: number;
  won: boolean;
  otLoss: boolean;
}

export interface ImpactSyncResult {
  playersProcessed: number;
  statsCreated: number;
  errors: string[];
}

// ── Helpers ──

function dec(val: number, places = 2): Prisma.Decimal {
  return new Prisma.Decimal(val.toFixed(places));
}

function decOrNull(val: number | null | undefined, places = 2): Prisma.Decimal | null {
  if (val == null || isNaN(val)) return null;
  return new Prisma.Decimal(val.toFixed(places));
}

function parseToi(toi: string | undefined): number {
  if (!toi) return 0;
  const parts = toi.split(":");
  if (parts.length !== 2) return 0;
  return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJSON(url: string, retries = 3): Promise<any | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 404) return null;
      if (res.status === 429) {
        await sleep(2000 * (i + 1));
        continue;
      }
      if (!res.ok) {
        if (i === retries - 1) return null;
        await sleep(500);
        continue;
      }
      return await res.json();
    } catch {
      if (i === retries - 1) return null;
      await sleep(500);
    }
  }
  return null;
}

// ── Game Score calculation ──
// Dom Luszczyszyn's Game Score formula (simplified):
// G*0.75 + A1*0.7 + A2*0.55 + SOG*0.075 + BLK*0.05 + PD*0.15 - PIM*0.15 + FOW*0.01 - FOL*0.01
// We simplify since we don't have primary/secondary assist split from game logs:
function calculateGameScore(
  goals: number,
  assists: number,
  shots: number,
  pim: number,
): number {
  return goals * 0.75 + assists * 0.6 + shots * 0.075 - pim * 0.15;
}

// ── Clutch rating calculation ──
// Derived from GWG, OT goals, and high-impact production
// Calibrated: Elite clutch 80-100, Clutch performer 60-79, Average 40-59,
// Below average 20-39, Non-factor 0-19
function calculateClutchRating(
  gameWinningGoals: number,
  overtimeGoals: number,
  highImpactGames: number,
  gp: number,
): number {
  if (gp === 0) return 0;
  // Normalize to per-82 game pace
  const gwgPer82 = (gameWinningGoals / gp) * 82;
  const otgPer82 = (overtimeGoals / gp) * 82;
  const hiPer82 = (highImpactGames / gp) * 82;

  // GWG: league avg ~4-5/season, elite ~8-10+
  const gwgScore = Math.min(100, (gwgPer82 / 7) * 100);
  // OT goals: rare, high value — 2-3/season is elite
  const otgScore = Math.min(100, otgPer82 * 35);
  // High-impact games (3+ pts or GWG) — 12+/season is elite
  const hiScore = Math.min(100, (hiPer82 / 12) * 100);
  // Base contribution for playing — rewards durability/availability
  const baseContribution = Math.min(15, (gp / 82) * 15);

  return Math.min(100, Math.round(
    gwgScore * 0.35 + otgScore * 0.20 + hiScore * 0.30 + baseContribution,
  ));
}

// ── Fetch team schedule to determine games player missed ──
async function fetchTeamSchedule(
  teamAbbrev: string,
  season: string,
): Promise<TeamGameResult[]> {
  // Use the team schedule endpoint
  const url = `${NHL_API}/club-schedule-season/${teamAbbrev}/${season.substring(0, 4)}${season.substring(4, 8)}`;
  const data = await fetchJSON(url);
  if (!data?.games) return [];

  return data.games
    .filter((g: any) => g.gameType === 2 && g.gameState === "OFF") // regular season, completed
    .map((g: any) => {
      const isHome = g.homeTeam?.abbrev === teamAbbrev;
      const homeScore = g.homeTeam?.score ?? 0;
      const awayScore = g.awayTeam?.score ?? 0;
      const won = isHome ? homeScore > awayScore : awayScore > homeScore;
      const otLoss = !won && (g.periodDescriptor?.periodType === "OT" || g.periodDescriptor?.periodType === "SO");
      return { gameId: g.id, won, otLoss };
    });
}

// ── Process a single skater ──
function processSkaterGameLog(
  games: GameLogEntry[],
  teamGames: TeamGameResult[],
) {
  if (games.length === 0) return null;

  const playerGameIds = new Set(games.map((g) => g.gameId));
  const teamGameMap = new Map(teamGames.map((g) => [g.gameId, g]));

  // Games the player was in
  let winsWithPlayer = 0;
  let gamesWithPlayer = 0;
  let winsWhenScoring = 0;
  let gamesWhenScoring = 0;
  let winsWhenGettingPoint = 0;
  let gamesWhenGettingPoint = 0;
  let winsWhenMultiPoint = 0;
  let gamesWhenMultiPoint = 0;
  let pointsInWins = 0;
  let goalsInWins = 0;
  let winsCount = 0;
  let highImpactGames = 0;
  let totalGameScore = 0;
  let totalGWG = 0;
  let totalOTG = 0;
  let totalToiMinutes = 0;
  let totalGoals = 0;

  for (const game of games) {
    const teamResult = teamGameMap.get(game.gameId);
    if (!teamResult) continue;

    gamesWithPlayer++;
    const toiMin = parseToi(game.toi);
    totalToiMinutes += toiMin;
    totalGoals += game.goals;

    if (teamResult.won) {
      winsWithPlayer++;
      winsCount++;
      pointsInWins += game.points;
      goalsInWins += game.goals;
    }

    if (game.goals > 0) {
      gamesWhenScoring++;
      if (teamResult.won) winsWhenScoring++;
    }

    if (game.points > 0) {
      gamesWhenGettingPoint++;
      if (teamResult.won) winsWhenGettingPoint++;
    }

    if (game.points >= 2) {
      gamesWhenMultiPoint++;
      if (teamResult.won) winsWhenMultiPoint++;
    }

    // High impact: 3+ points or GWG
    if (game.points >= 3 || game.gameWinningGoals > 0) {
      highImpactGames++;
    }

    totalGWG += game.gameWinningGoals;
    totalOTG += game.otGoals;

    totalGameScore += calculateGameScore(
      game.goals,
      game.assists,
      game.shots,
      game.pim,
    );
  }

  // Games the player was NOT in
  let winsWithout = 0;
  let gamesWithout = 0;
  for (const entry of Array.from(teamGameMap.entries())) {
    if (!playerGameIds.has(entry[0])) {
      gamesWithout++;
      if (entry[1].won) winsWithout++;
    }
  }

  const winPctWith = gamesWithPlayer > 0 ? winsWithPlayer / gamesWithPlayer : 0;
  const winPctWithout = gamesWithout > 0 ? winsWithout / gamesWithout : 0;
  const lossesWithPlayer = gamesWithPlayer - winsWithPlayer;
  const otlWithPlayer = games.filter((g) => {
    const r = teamGameMap.get(g.gameId);
    return r && !r.won && r.otLoss;
  }).length;
  const lossesWithout = gamesWithout - winsWithout;
  const otlWithout = teamGames.filter(
    (g) => !playerGameIds.has(g.gameId) && !g.won && g.otLoss,
  ).length;

  const avgGameScore = gamesWithPlayer > 0 ? totalGameScore / gamesWithPlayer : 0;
  const clutchRating = calculateClutchRating(totalGWG, totalOTG, highImpactGames, gamesWithPlayer);

  return {
    teamWinPctWithPlayer: winPctWith,
    teamWinPctWithout: winPctWithout,
    winPctDifferential: winPctWith - winPctWithout,
    teamWinPctWhenScoring: gamesWhenScoring > 0 ? winsWhenScoring / gamesWhenScoring : null,
    teamWinPctWhenGettingPoint: gamesWhenGettingPoint > 0 ? winsWhenGettingPoint / gamesWhenGettingPoint : null,
    teamWinPctWhenMultiPoint: gamesWhenMultiPoint > 0 ? winsWhenMultiPoint / gamesWhenMultiPoint : null,
    teamRecordWithPlayer: `${winsWithPlayer}-${lossesWithPlayer - otlWithPlayer}-${otlWithPlayer}`,
    teamRecordWithout: `${winsWithout}-${lossesWithout - otlWithout}-${otlWithout}`,
    pointsPerGameInWins: winsCount > 0 ? pointsInWins / winsCount : null,
    goalsPerGameInWins: winsCount > 0 ? goalsInWins / winsCount : null,
    gameScore: avgGameScore,
    highImpactGames,
    clutchRating,
    onIceGoalsForPer60: null as number | null,
    onIceGoalsAgainstPer60: null as number | null,
    onIceShootingPct: null as number | null,
    onIceSavePct: null as number | null,
    pdo: null as number | null,
  };
}

// ── Process a single goalie ──
function processGoalieGameLog(
  games: GoalieGameLogEntry[],
  teamGames: TeamGameResult[],
) {
  if (games.length === 0) return null;

  const playerGameIds = new Set(games.map((g) => g.gameId));
  const teamGameMap = new Map(teamGames.map((g) => [g.gameId, g]));

  let winsWithGoalie = 0;
  let gamesWithGoalie = 0;
  let winsWithout = 0;
  let gamesWithout = 0;
  let shutoutGames = 0;

  for (const game of games) {
    if (game.gamesStarted === 0) continue;
    const teamResult = teamGameMap.get(game.gameId);
    if (!teamResult) continue;
    gamesWithGoalie++;
    if (teamResult.won) winsWithGoalie++;
    if (game.goalsAgainst === 0) shutoutGames++;
  }

  for (const entry of Array.from(teamGameMap.entries())) {
    if (!playerGameIds.has(entry[0])) {
      gamesWithout++;
      if (entry[1].won) winsWithout++;
    }
  }

  const winPctWith = gamesWithGoalie > 0 ? winsWithGoalie / gamesWithGoalie : 0;
  const winPctWithout = gamesWithout > 0 ? winsWithout / gamesWithout : 0;
  const lossesWithGoalie = gamesWithGoalie - winsWithGoalie;
  const otlWithGoalie = games.filter((g) => {
    if (g.gamesStarted === 0) return false;
    const r = teamGameMap.get(g.gameId);
    return r && !r.won && r.otLoss;
  }).length;
  const lossesWithout = gamesWithout - winsWithout;
  const otlWithout = teamGames.filter(
    (g) => !playerGameIds.has(g.gameId) && !g.won && g.otLoss,
  ).length;

  // Clutch for goalies = shutouts + low-GA performance
  const clutchRating = gamesWithGoalie > 0
    ? Math.min(100, Math.round((shutoutGames / gamesWithGoalie) * 300 + (winPctWith * 30)))
    : 0;

  return {
    teamWinPctWithPlayer: winPctWith,
    teamWinPctWithout: winPctWithout,
    winPctDifferential: winPctWith - winPctWithout,
    teamWinPctWhenScoring: null,
    teamWinPctWhenGettingPoint: null,
    teamWinPctWhenMultiPoint: null,
    teamRecordWithPlayer: `${winsWithGoalie}-${lossesWithGoalie - otlWithGoalie}-${otlWithGoalie}`,
    teamRecordWithout: `${winsWithout}-${lossesWithout - otlWithout}-${otlWithout}`,
    pointsPerGameInWins: null,
    goalsPerGameInWins: null,
    gameScore: null as number | null,
    highImpactGames: shutoutGames,
    clutchRating,
    onIceGoalsForPer60: null as number | null,
    onIceGoalsAgainstPer60: null as number | null,
    onIceShootingPct: null as number | null,
    onIceSavePct: null as number | null,
    pdo: null as number | null,
  };
}

// ── Default seasons to sync (current + 4 prior) ──
const DEFAULT_SEASONS = [
  "20252026",
  "20242025",
  "20232024",
  "20222023",
  "20212022",
];

// ── Main sync function ──

export async function syncImpactStats(
  prisma: PrismaClient,
  options?: { seasons?: string[]; concurrency?: number },
): Promise<ImpactSyncResult> {
  const seasons = options?.seasons ?? DEFAULT_SEASONS;
  const concurrency = options?.concurrency ?? 10;

  const totalResult: ImpactSyncResult = {
    playersProcessed: 0,
    statsCreated: 0,
    errors: [],
  };

  // Get all active players
  const players = await prisma.player.findMany({
    where: { isActive: true, currentTeamId: { not: null } },
    select: {
      id: true,
      nhlApiId: true,
      position: true,
      fullName: true,
    },
  });

  for (const seasonId of seasons) {
    console.log(`[ImpactSync] Starting impact stats sync for season ${seasonId}`);

    // Delete existing impact stats for this season
    await prisma.playerImpactStats.deleteMany({
      where: { season: seasonId },
    });

    // Cache team schedules per season (keyed by "team-season")
    const teamScheduleCache = new Map<string, TeamGameResult[]>();

    let seasonStats = 0;

    // Process in batches
    for (let i = 0; i < players.length; i += concurrency) {
      const batch = players.slice(i, i + concurrency);

      await Promise.all(
        batch.map(async (player) => {
          try {
            const isGoalie = player.position === "G";

            // Fetch player game log first — this tells us which team they were on
            const url = `${NHL_API}/player/${player.nhlApiId}/game-log/${seasonId}/2`;
            const data = await fetchJSON(url);
            if (!data?.gameLog || data.gameLog.length === 0) return;

            // Determine team from game log entries (handles trades / historical teams)
            const teamAbbrev = data.gameLog[0].teamAbbrev;
            if (!teamAbbrev) return;

            // Fetch team schedule (cached by team+season)
            const cacheKey = `${teamAbbrev}-${seasonId}`;
            if (!teamScheduleCache.has(cacheKey)) {
              const schedule = await fetchTeamSchedule(teamAbbrev, seasonId);
              teamScheduleCache.set(cacheKey, schedule);
            }
            const teamGames = teamScheduleCache.get(cacheKey) ?? [];

            if (teamGames.length === 0) return;

            let impactData;

            if (isGoalie) {
              const games: GoalieGameLogEntry[] = data.gameLog.map((g: any) => ({
                gameId: g.gameId,
                teamAbbrev: g.teamAbbrev,
                homeRoadFlag: g.homeRoadFlag,
                gameDate: g.gameDate,
                gamesStarted: g.gamesStarted ?? 0,
                decision: g.decision ?? "",
                shotsAgainst: g.shotsAgainst ?? 0,
                goalsAgainst: g.goalsAgainst ?? 0,
                savePctg: g.savePctg ?? 0,
                shutouts: g.shutouts ?? 0,
                toi: g.toi,
                opponentAbbrev: g.opponentAbbrev,
              }));
              impactData = processGoalieGameLog(games, teamGames);
            } else {
              const games: GameLogEntry[] = data.gameLog.map((g: any) => ({
                gameId: g.gameId,
                teamAbbrev: g.teamAbbrev,
                homeRoadFlag: g.homeRoadFlag,
                gameDate: g.gameDate,
                goals: g.goals ?? 0,
                assists: g.assists ?? 0,
                points: g.points ?? 0,
                plusMinus: g.plusMinus ?? 0,
                powerPlayGoals: g.powerPlayGoals ?? 0,
                gameWinningGoals: g.gameWinningGoals ?? 0,
                otGoals: g.otGoals ?? 0,
                shots: g.shots ?? 0,
                pim: g.pim ?? 0,
                toi: g.toi,
                opponentAbbrev: g.opponentAbbrev,
              }));
              impactData = processSkaterGameLog(games, teamGames);
            }

            if (!impactData) return;

            await prisma.playerImpactStats.create({
              data: {
                playerId: player.id,
                season: seasonId,
                teamWinPctWithPlayer: decOrNull(impactData.teamWinPctWithPlayer, 3),
                teamWinPctWithout: decOrNull(impactData.teamWinPctWithout, 3),
                winPctDifferential: decOrNull(impactData.winPctDifferential, 3),
                teamWinPctWhenScoring: decOrNull(impactData.teamWinPctWhenScoring, 3),
                teamWinPctWhenGettingPoint: decOrNull(impactData.teamWinPctWhenGettingPoint, 3),
                teamWinPctWhenMultiPoint: decOrNull(impactData.teamWinPctWhenMultiPoint, 3),
                teamRecordWithPlayer: impactData.teamRecordWithPlayer,
                teamRecordWithout: impactData.teamRecordWithout,
                pointsPerGameInWins: decOrNull(impactData.pointsPerGameInWins, 3),
                goalsPerGameInWins: decOrNull(impactData.goalsPerGameInWins, 3),
                gameScore: decOrNull(impactData.gameScore),
                highImpactGames: impactData.highImpactGames,
                clutchRating: decOrNull(impactData.clutchRating),
                onIceGoalsForPer60: decOrNull(impactData.onIceGoalsForPer60),
                onIceGoalsAgainstPer60: decOrNull(impactData.onIceGoalsAgainstPer60),
                onIceShootingPct: decOrNull(impactData.onIceShootingPct),
                onIceSavePct: decOrNull(impactData.onIceSavePct, 3),
                pdo: decOrNull(impactData.pdo, 3),
              },
            });

            seasonStats++;
            totalResult.statsCreated++;
          } catch (error) {
            totalResult.errors.push(
              `${player.fullName} (${seasonId}): ${error instanceof Error ? error.message : error}`,
            );
          }
        }),
      );

      // Rate limit between batches
      if (i + concurrency < players.length) {
        await sleep(200);
      }
    }

    console.log(
      `[ImpactSync] Season ${seasonId}: ${seasonStats} players processed`,
    );
  }

  totalResult.playersProcessed = players.length;
  console.log(
    `[ImpactSync] Complete: ${totalResult.statsCreated} total stats across ${seasons.length} seasons, ${totalResult.errors.length} errors`,
  );

  return totalResult;
}
