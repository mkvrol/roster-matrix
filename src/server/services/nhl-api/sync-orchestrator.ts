import { syncTeams, type TeamSyncResult } from "./team-sync";
import { syncPlayers, type PlayerSyncResult } from "./player-sync";
import { syncStats, type StatsSyncResult } from "./stats-sync";

export interface SyncReport {
  type: "full" | "daily";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  teams?: TeamSyncResult;
  players?: PlayerSyncResult;
  stats: StatsSyncResult;
  success: boolean;
}

export async function runFullSync(): Promise<SyncReport> {
  const startedAt = new Date();
  console.log(`[Sync] Starting full sync at ${startedAt.toISOString()}`);

  let teams: TeamSyncResult | undefined;
  let players: PlayerSyncResult | undefined;
  let stats: StatsSyncResult = {
    skaterStats: 0,
    goalieStats: 0,
    errors: 0,
    skipped: 0,
    details: [],
  };

  try {
    // Step 1: Sync teams
    console.log("[Sync] Step 1/3: Syncing teams...");
    teams = await syncTeams();

    // Step 2: Sync players
    console.log("[Sync] Step 2/3: Syncing players...");
    players = await syncPlayers();

    // Step 3: Sync stats (all seasons)
    console.log("[Sync] Step 3/3: Syncing stats (all seasons)...");
    stats = await syncStats(false);
  } catch (error) {
    console.error(
      `[Sync] Fatal error during full sync: ${error instanceof Error ? error.message : error}`,
    );
    stats.details.push(
      `Fatal: ${error instanceof Error ? error.message : error}`,
    );
  }

  const completedAt = new Date();
  const report: SyncReport = {
    type: "full",
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    teams,
    players,
    stats,
    success:
      (teams?.errors ?? 0) === 0 &&
      (players?.errors ?? 0) === 0 &&
      stats.errors === 0,
  };

  console.log("[Sync] Full sync report:", JSON.stringify(report, null, 2));
  return report;
}

export async function runDailySync(): Promise<SyncReport> {
  const startedAt = new Date();
  console.log(`[Sync] Starting daily sync at ${startedAt.toISOString()}`);

  let stats: StatsSyncResult = {
    skaterStats: 0,
    goalieStats: 0,
    errors: 0,
    skipped: 0,
    details: [],
  };

  try {
    // Daily sync: current season stats only
    console.log("[Sync] Syncing current season stats...");
    stats = await syncStats(true);
  } catch (error) {
    console.error(
      `[Sync] Fatal error during daily sync: ${error instanceof Error ? error.message : error}`,
    );
    stats.details.push(
      `Fatal: ${error instanceof Error ? error.message : error}`,
    );
  }

  const completedAt = new Date();
  const report: SyncReport = {
    type: "daily",
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    stats,
    success: stats.errors === 0,
  };

  console.log("[Sync] Daily sync report:", JSON.stringify(report, null, 2));
  return report;
}
