import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

function decOrNull(val: string | undefined): Prisma.Decimal | null {
  if (!val || val === "") return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : new Prisma.Decimal(n);
}

function intOrNull(val: string | undefined): number | null {
  if (!val || val === "") return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });
    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "No file provided. Use form field 'file'." },
        { status: 400 },
      );
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV is empty" }, { status: 400 });
    }

    let imported = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (const row of rows) {
      try {
        const nhlApiId = parseInt(row.nhlApiId, 10);
        const season = row.season;
        if (isNaN(nhlApiId) || !season) {
          errors++;
          errorDetails.push(`Invalid row: nhlApiId=${row.nhlApiId}, season=${row.season}`);
          continue;
        }

        const player = await prisma.player.findUnique({
          where: { nhlApiId },
          select: { id: true, currentTeamId: true },
        });

        if (!player) {
          errors++;
          errorDetails.push(`Player not found: nhlApiId=${nhlApiId}`);
          continue;
        }

        await prisma.advancedStats.upsert({
          where: {
            playerId_season: { playerId: player.id, season },
          },
          create: {
            playerId: player.id,
            season,
            teamId: player.currentTeamId,
            corsiFor: decOrNull(row.corsiFor),
            corsiAgainst: decOrNull(row.corsiAgainst),
            corsiForPct: decOrNull(row.corsiForPct),
            fenwickForPct: decOrNull(row.fenwickForPct),
            expectedGoalsFor: decOrNull(row.expectedGoalsFor),
            expectedGoalsAgainst: decOrNull(row.expectedGoalsAgainst),
            xGFPct: decOrNull(row.xGFPct),
            goalsForPct: decOrNull(row.goalsForPct),
            offensiveZoneStartPct: decOrNull(row.offensiveZoneStartPct),
            defensiveZoneStartPct: decOrNull(row.defensiveZoneStartPct),
            individualExpectedGoals: decOrNull(row.individualExpectedGoals),
            individualHighDangerChances: intOrNull(row.individualHighDangerChances),
            onIceShootingPct: decOrNull(row.onIceShootingPct),
            onIceSavePct: decOrNull(row.onIceSavePct),
            pdo: decOrNull(row.pdo),
            relCorsiForPct: decOrNull(row.relCorsiForPct),
            relXGFPct: decOrNull(row.relXGFPct),
          },
          update: {
            corsiFor: decOrNull(row.corsiFor),
            corsiAgainst: decOrNull(row.corsiAgainst),
            corsiForPct: decOrNull(row.corsiForPct),
            fenwickForPct: decOrNull(row.fenwickForPct),
            expectedGoalsFor: decOrNull(row.expectedGoalsFor),
            expectedGoalsAgainst: decOrNull(row.expectedGoalsAgainst),
            xGFPct: decOrNull(row.xGFPct),
            goalsForPct: decOrNull(row.goalsForPct),
            offensiveZoneStartPct: decOrNull(row.offensiveZoneStartPct),
            defensiveZoneStartPct: decOrNull(row.defensiveZoneStartPct),
            individualExpectedGoals: decOrNull(row.individualExpectedGoals),
            individualHighDangerChances: intOrNull(row.individualHighDangerChances),
            onIceShootingPct: decOrNull(row.onIceShootingPct),
            onIceSavePct: decOrNull(row.onIceSavePct),
            pdo: decOrNull(row.pdo),
            relCorsiForPct: decOrNull(row.relCorsiForPct),
            relXGFPct: decOrNull(row.relXGFPct),
          },
        });

        imported++;
      } catch (error) {
        errors++;
        errorDetails.push(
          `Row error: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return NextResponse.json({
      imported,
      errors,
      total: rows.length,
      errorDetails: errorDetails.slice(0, 20),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 },
    );
  }
}
