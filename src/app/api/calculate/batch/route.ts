import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateAllValueScores,
  calculateHistoricalValueScores,
} from "@/server/services/value-batch";

export const maxDuration = 300;

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
      return NextResponse.json(
        { error: "Forbidden: admin only" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { season, historical } = body as {
      season?: string;
      historical?: boolean;
    };

    if (historical) {
      const results = await calculateHistoricalValueScores();
      return NextResponse.json({
        type: "historical",
        seasons: results.length,
        results,
      });
    }

    const result = await calculateAllValueScores(season);

    return NextResponse.json(result, {
      status: result.failed > 0 ? 207 : 200,
    });
  } catch (error) {
    console.error("[API /calculate/batch] Error:", error);
    return NextResponse.json(
      {
        error: "Batch calculation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
