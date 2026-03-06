import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncStats } from "@/server/services/nhl-api/stats-sync";
import { calculateAllValueScores } from "@/server/services/value-batch";
import { verifyCronAuth } from "../_auth";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!(await verifyCronAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  console.log(`[Cron:StatsSync] Starting at ${startedAt.toISOString()}`);

  const jobRun = await prisma.jobRun.create({
    data: { jobName: "cron-stats-sync", status: "started", startedAt },
  });

  const result = {
    stats: { skaterStats: 0, goalieStats: 0, errors: 0, skipped: 0, details: [] as string[] },
    valueScores: { processed: 0, skipped: 0, failed: 0, durationMs: 0 },
    errors: [] as string[],
  };

  try {
    // Step 1: Sync current season stats from NHL API
    console.log("[Cron:StatsSync] Step 1/2: Syncing current season stats...");
    result.stats = await syncStats(true);

    // Step 2: Recalculate all value scores
    console.log("[Cron:StatsSync] Step 2/2: Recalculating value scores...");
    const valueResult = await calculateAllValueScores();
    result.valueScores = {
      processed: valueResult.processed,
      skipped: valueResult.skipped,
      failed: valueResult.failed,
      durationMs: valueResult.durationMs,
    };

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: { status: "completed", completedAt, durationMs, result: result as object },
    });

    console.log(
      `[Cron:StatsSync] Complete in ${durationMs}ms — ${result.stats.skaterStats} skaters, ${result.stats.goalieStats} goalies, ${result.valueScores.processed} value scores`,
    );

    return NextResponse.json(result);
  } catch (error) {
    const completedAt = new Date();
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "failed",
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        error: error instanceof Error ? error.message : String(error),
      },
    });

    console.error("[Cron:StatsSync] Fatal:", error);
    return NextResponse.json(
      { error: "Stats sync failed", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
