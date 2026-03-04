import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();

  let dbStatus: "ok" | "error" = "error";
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
    dbStatus = "ok";
  } catch {
    dbStatus = "error";
  }

  const overall = dbStatus === "ok" ? "ok" : "degraded";

  const response = {
    status: overall,
    version: process.env.APP_VERSION ?? "0.1.0",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    checks: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
    },
    responseTimeMs: Date.now() - start,
  };

  return NextResponse.json(response, {
    status: overall === "ok" ? 200 : 503,
  });
}
