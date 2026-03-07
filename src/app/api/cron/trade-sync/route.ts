import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncTrades } from "@/server/services/trade-sync";
import { verifyCronAuth } from "../_auth";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!(await verifyCronAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  console.log(`[Cron:TradeSync] Starting at ${startedAt.toISOString()}`);

  const jobRun = await prisma.jobRun.create({
    data: { jobName: "cron-trade-sync", status: "started", startedAt },
  });

  try {
    const result = await syncTrades();

    const duration = Date.now() - startedAt.getTime();
    console.log(
      `[Cron:TradeSync] Completed in ${duration}ms — ${result.tradesCreated} trades created, ${result.skipped} skipped`,
    );

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        result: JSON.parse(JSON.stringify(result)),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[Cron:TradeSync] Failed:`, message);

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        error: message,
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
