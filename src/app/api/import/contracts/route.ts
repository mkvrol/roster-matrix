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

const VALID_STRUCTURES = new Set([
  "FRONT_LOADED",
  "BACK_LOADED",
  "EVEN",
  "FLAT",
]);
const VALID_SIGNING_TYPES = new Set(["RFA", "UFA", "ELC", "EXTENSION"]);

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
        if (isNaN(nhlApiId)) {
          errors++;
          errorDetails.push(`Invalid nhlApiId: ${row.nhlApiId}`);
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

        const startYear = parseInt(row.startYear, 10);
        const endYear = parseInt(row.endYear, 10);
        const totalYears = parseInt(row.totalYears, 10);
        const aav = parseFloat(row.aav);
        const totalValue = parseFloat(row.totalValue);

        if ([startYear, endYear, totalYears, aav, totalValue].some(isNaN)) {
          errors++;
          errorDetails.push(`Invalid numeric fields for nhlApiId=${nhlApiId}`);
          continue;
        }

        const structure = VALID_STRUCTURES.has(row.structure)
          ? (row.structure as "FRONT_LOADED" | "BACK_LOADED" | "EVEN" | "FLAT")
          : "FLAT";

        const signingType = VALID_SIGNING_TYPES.has(row.signingType)
          ? (row.signingType as "RFA" | "UFA" | "ELC" | "EXTENSION")
          : null;

        let capHitByYear: Record<string, number> = {};
        if (row.capHitByYear) {
          try {
            capHitByYear = JSON.parse(row.capHitByYear);
          } catch {
            // Generate flat cap hits
            for (let y = startYear; y < endYear; y++) {
              capHitByYear[`${y}-${String(y + 1).slice(2)}`] = aav;
            }
          }
        } else {
          for (let y = startYear; y < endYear; y++) {
            capHitByYear[`${y}-${String(y + 1).slice(2)}`] = aav;
          }
        }

        const teamId = player.currentTeamId;
        if (!teamId) {
          errors++;
          errorDetails.push(`No team for player nhlApiId=${nhlApiId}`);
          continue;
        }

        await prisma.contract.create({
          data: {
            playerId: player.id,
            teamId,
            startYear,
            endYear,
            totalYears,
            aav: new Prisma.Decimal(aav),
            totalValue: new Prisma.Decimal(totalValue),
            structure,
            capHitByYear,
            signingAge: row.signingAge ? parseInt(row.signingAge, 10) : null,
            hasNTC: row.hasNTC === "true" || row.hasNTC === "1",
            hasNMC: row.hasNMC === "true" || row.hasNMC === "1",
            tradeProtectionDetails: row.tradeProtectionDetails || null,
            signingType,
            source: row.source || "csv-import",
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
