import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateSinglePlayerScore } from "@/server/services/value-batch";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
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
    const { season } = body as { season?: string };

    const result = await calculateSinglePlayerScore(params.id, season);

    return NextResponse.json({
      playerId: params.id,
      overall: result.overall,
      grade: result.grade,
      meta: result.meta,
      components: result.components,
    });
  } catch (error) {
    console.error(`[API /calculate/player/${params.id}] Error:`, error);

    if (
      error instanceof Error &&
      error.message.includes("No PlayerValueScore found")
    ) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: "Calculation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
