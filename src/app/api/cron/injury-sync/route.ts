import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { InjuryType } from "@prisma/client";
import { verifyCronAuth } from "../_auth";

export const maxDuration = 300;

const NHL_API = "https://api-web.nhle.com/v1";

async function fetchJSON(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function mapInjuryType(status: string): InjuryType {
  const s = status.toUpperCase();
  if (s.includes("LTIR") || s.includes("LONG TERM")) return "LTIR";
  if (s.includes("IR") || s.includes("INJURED RESERVE")) return "IR";
  if (s.includes("DAY") || s.includes("DTD")) return "DAY_TO_DAY";
  return "OUT";
}

export async function GET(request: NextRequest) {
  if (!(await verifyCronAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  console.log(`[Cron:InjurySync] Starting at ${startedAt.toISOString()}`);

  const jobRun = await prisma.jobRun.create({
    data: { jobName: "cron-injury-sync", status: "started", startedAt },
  });

  const result = {
    injuriesAdded: 0,
    injuriesResolved: 0,
    playersChecked: 0,
    errors: [] as string[],
  };

  try {
    // Get all active players with their teams
    const players = await prisma.player.findMany({
      where: { isActive: true, currentTeamId: { not: null } },
      select: {
        id: true,
        nhlApiId: true,
        fullName: true,
        currentTeamId: true,
      },
    });

    // Get current injuries in DB to track what to resolve
    const existingInjuries = await prisma.injury.findMany({
      select: { id: true, playerId: true },
    });
    const injuredPlayerIds = new Set(existingInjuries.map((i) => i.playerId));
    const stillInjuredPlayerIds = new Set<string>();

    // Check each player's landing page for injury status
    // Process in batches to respect rate limits
    const batchSize = 15;
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (player) => {
          try {
            const data = await fetchJSON(`${NHL_API}/player/${player.nhlApiId}/landing`);
            if (!data) return;

            result.playersChecked++;

            // The NHL landing endpoint may include injury fields
            const injuryStatus: string | undefined = data.injuryStatus;
            const injuryDescription: string | undefined = data.injuryDescription;

            if (injuryStatus && injuryStatus !== "HEALTHY" && injuryStatus !== "") {
              stillInjuredPlayerIds.add(player.id);

              // Only create if not already tracked
              if (!injuredPlayerIds.has(player.id)) {
                await prisma.injury.create({
                  data: {
                    playerId: player.id,
                    teamId: player.currentTeamId!,
                    type: mapInjuryType(injuryStatus),
                    description: injuryDescription ?? injuryStatus,
                    date: new Date(),
                  },
                });
                result.injuriesAdded++;
              }
            }
          } catch (error) {
            result.errors.push(
              `${player.fullName}: ${error instanceof Error ? error.message : error}`,
            );
          }
        }),
      );

      // Rate limit between batches
      if (i + batchSize < players.length) {
        await sleep(300);
      }
    }

    // Resolve injuries for players no longer showing as injured
    const toResolve = existingInjuries.filter(
      (inj) => !stillInjuredPlayerIds.has(inj.playerId),
    );
    if (toResolve.length > 0) {
      await prisma.injury.deleteMany({
        where: { id: { in: toResolve.map((i) => i.id) } },
      });
      result.injuriesResolved = toResolve.length;
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: { status: "completed", completedAt, durationMs, result: result as object },
    });

    console.log(
      `[Cron:InjurySync] Complete in ${durationMs}ms — ${result.playersChecked} checked, ${result.injuriesAdded} added, ${result.injuriesResolved} resolved`,
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

    console.error("[Cron:InjurySync] Fatal:", error);
    return NextResponse.json(
      { error: "Injury sync failed", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
