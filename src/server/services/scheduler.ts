import cron from "node-cron";
import { prisma } from "@/lib/prisma";
import { runFullSync, runDailySync } from "@/server/services/nhl-api/sync-orchestrator";
import { calculateAllValueScores } from "@/server/services/value-batch";

async function runJob(
  jobName: string,
  fn: () => Promise<unknown>,
): Promise<void> {
  const startedAt = new Date();
  console.log(`[Scheduler] Starting job: ${jobName} at ${startedAt.toISOString()}`);

  const jobRun = await prisma.jobRun.create({
    data: {
      jobName,
      status: "started",
      startedAt,
    },
  });

  try {
    const result = await fn();
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "completed",
        completedAt,
        durationMs,
        result: result as object,
      },
    });

    console.log(
      `[Scheduler] Job ${jobName} completed in ${durationMs}ms`,
    );
  } catch (error) {
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "failed",
        completedAt,
        durationMs,
        error: errorMessage,
      },
    });

    console.error(
      `[Scheduler] Job ${jobName} failed after ${durationMs}ms: ${errorMessage}`,
    );
  }
}

export function startScheduler(): void {
  console.log("[Scheduler] Initializing scheduled jobs...");

  // Daily stat sync at 6 AM ET
  cron.schedule(
    "0 6 * * *",
    () => {
      runJob("daily-sync", runDailySync);
    },
    { timezone: "America/New_York" },
  );
  console.log("[Scheduler] Registered: daily-sync (6:00 AM ET daily)");

  // Full sync every Monday at 3 AM ET
  cron.schedule(
    "0 3 * * 1",
    () => {
      runJob("full-sync", runFullSync);
    },
    { timezone: "America/New_York" },
  );
  console.log("[Scheduler] Registered: full-sync (3:00 AM ET Mondays)");

  // Recalculate value scores daily at 7 AM ET (after stats sync completes)
  cron.schedule(
    "0 7 * * *",
    () => {
      runJob("value-score-batch", calculateAllValueScores);
    },
    { timezone: "America/New_York" },
  );
  console.log("[Scheduler] Registered: value-score-batch (7:00 AM ET daily)");

  console.log("[Scheduler] All jobs registered.");
}
