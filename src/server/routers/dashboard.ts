// ──────────────────────────────────────────────
// Roster Matrix — Dashboard Router
// Backend procedures powering the GM command center
// ──────────────────────────────────────────────

import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { prisma } from "@/lib/prisma";
import { getLatestSeason } from "@/server/services/value-batch";

const SALARY_CAP = 95_500_000;
const CURRENT_SEASON_START = 2025;
const CURRENT_SEASON_END = 2026;

async function getUserTeamId(
  session: { user?: { email?: string | null } },
): Promise<string | null> {
  if (!session.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { teamAffiliationId: true },
  });
  return user?.teamAffiliationId ?? null;
}

export const dashboardRouter = router({
  // ── Key metrics for the top stat cards ──
  getMetrics: protectedProcedure.query(async ({ ctx }) => {
    const teamId = await getUserTeamId(ctx.session);
    const season = await getLatestSeason();

    const scoreWhere: Record<string, unknown> = { season };
    if (teamId) {
      scoreWhere.player = { currentTeamId: teamId };
    }

    const scores = await prisma.playerValueScore.findMany({
      where: scoreWhere,
      orderBy: { calculatedAt: "desc" },
      distinct: ["playerId"],
      select: { overallScore: true },
    });

    const totalPlayers = scores.length;
    const avgScore =
      totalPlayers > 0
        ? Math.round(
            scores.reduce((s, v) => s + v.overallScore, 0) / totalPlayers,
          )
        : 0;
    const outperformers = scores.filter((s) => s.overallScore >= 60).length;
    const underperformers = scores.filter((s) => s.overallScore < 40).length;

    let capHit = 0;
    if (teamId) {
      const contracts = await prisma.contract.findMany({
        where: {
          player: { currentTeamId: teamId },
          startYear: { lte: CURRENT_SEASON_START },
          endYear: { gte: CURRENT_SEASON_END },
        },
        select: { aav: true },
      });
      capHit = contracts.reduce((s, c) => s + Number(c.aav), 0);
    }

    return {
      capHit,
      capCeiling: SALARY_CAP,
      capSpace: SALARY_CAP - capHit,
      avgScore,
      outperformers,
      underperformers,
      totalPlayers,
      hasTeam: !!teamId,
    };
  }),

  // ── Full roster for team snapshot table ──
  getTeamRoster: protectedProcedure.query(async ({ ctx }) => {
    const teamId = await getUserTeamId(ctx.session);
    const season = await getLatestSeason();

    const where = teamId
      ? { currentTeamId: teamId, isActive: true }
      : { isActive: true, valueScores: { some: { season } } };

    const players = await prisma.player.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        position: true,
        headshotUrl: true,
        nhlApiId: true,
        currentTeam: { select: { abbreviation: true, name: true } },
        contracts: {
          orderBy: { startYear: "desc" as const },
          take: 1,
          select: { aav: true, endYear: true },
        },
        seasonStats: {
          where: { season },
          take: 1,
          select: {
            points: true,
            gamesPlayed: true,
            goals: true,
            assists: true,
          },
        },
        valueScores: {
          orderBy: { calculatedAt: "desc" as const },
          take: 6,
          select: { overallScore: true, grade: true },
        },
      },
    });

    const result = players
      .filter((p) => p.valueScores.length > 0 && p.contracts.length > 0)
      .map((p) => ({
        playerId: p.id,
        playerName: p.fullName,
        position: p.position,
        teamAbbreviation: p.currentTeam?.abbreviation ?? null,
        headshotUrl: p.headshotUrl,
        nhlApiId: p.nhlApiId,
        aav: Number(p.contracts[0].aav),
        contractEndYear: p.contracts[0].endYear,
        points: p.seasonStats[0]?.points ?? 0,
        goals: p.seasonStats[0]?.goals ?? 0,
        gamesPlayed: p.seasonStats[0]?.gamesPlayed ?? 0,
        overallScore: p.valueScores[0].overallScore,
        grade: p.valueScores[0].grade,
        sparkline: p.valueScores.map((v) => v.overallScore).reverse(),
      }));

    result.sort((a, b) => b.overallScore - a.overallScore);

    return {
      isTeamView: !!teamId,
      players: teamId ? result : result.slice(0, 25),
    };
  }),

  // ── Contracts expiring this year or next ──
  getExpiringContracts: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ input }) => {
      const season = await getLatestSeason();

      const contracts = await prisma.contract.findMany({
        where: {
          endYear: { in: [CURRENT_SEASON_END, CURRENT_SEASON_END + 1] },
          player: { isActive: true },
        },
        include: {
          player: {
            select: {
              id: true,
              fullName: true,
              position: true,
              currentTeam: { select: { abbreviation: true } },
              valueScores: {
                where: { season },
                orderBy: { calculatedAt: "desc" },
                take: 1,
                select: { overallScore: true, grade: true },
              },
            },
          },
        },
        orderBy: { aav: "desc" },
      });

      const result = contracts
        .filter((c) => c.player.valueScores.length > 0)
        .map((c) => ({
          playerId: c.player.id,
          playerName: c.player.fullName,
          position: c.player.position,
          teamAbbreviation: c.player.currentTeam?.abbreviation ?? null,
          aav: Number(c.aav),
          endYear: c.endYear,
          expiresThisYear: c.endYear === CURRENT_SEASON_END,
          overallScore: c.player.valueScores[0]?.overallScore ?? 0,
          grade: c.player.valueScores[0]?.grade ?? null,
        }));

      result.sort((a, b) => b.overallScore - a.overallScore);
      return result.slice(0, input.limit);
    }),

  // ── Significant value changes (±10 points) ──
  getValueAlerts: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(10) }))
    .query(async ({ input }) => {
      const season = await getLatestSeason();

      const playersWithScores = await prisma.player.findMany({
        where: {
          isActive: true,
          valueScores: { some: { season } },
        },
        select: {
          id: true,
          fullName: true,
          position: true,
          currentTeam: { select: { abbreviation: true } },
          valueScores: {
            where: { season },
            orderBy: { calculatedAt: "desc" },
            take: 2,
            select: { overallScore: true, calculatedAt: true },
          },
        },
      });

      type Alert = {
        playerId: string;
        playerName: string;
        position: string;
        teamAbbreviation: string | null;
        previousScore: number;
        currentScore: number;
        delta: number;
        direction: "up" | "down";
        calculatedAt: Date;
      };

      const alerts: Alert[] = [];

      for (const p of playersWithScores) {
        if (p.valueScores.length < 2) continue;
        const current = p.valueScores[0];
        const previous = p.valueScores[1];
        const delta = current.overallScore - previous.overallScore;

        if (Math.abs(delta) >= 10) {
          alerts.push({
            playerId: p.id,
            playerName: p.fullName,
            position: p.position,
            teamAbbreviation: p.currentTeam?.abbreviation ?? null,
            previousScore: previous.overallScore,
            currentScore: current.overallScore,
            delta,
            direction: delta > 0 ? "up" : "down",
            calculatedAt: current.calculatedAt,
          });
        }
      }

      alerts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
      return alerts.slice(0, input.limit);
    }),

  // ── Cap space breakdown for visual tracker ──
  getCapSummary: protectedProcedure.query(async ({ ctx }) => {
    const teamId = await getUserTeamId(ctx.session);
    if (!teamId) return null;

    const currentContracts = await prisma.contract.findMany({
      where: {
        player: { currentTeamId: teamId },
        startYear: { lte: CURRENT_SEASON_START },
        endYear: { gte: CURRENT_SEASON_END },
      },
      select: { aav: true, endYear: true },
    });

    const currentCapHit = currentContracts.reduce(
      (s, c) => s + Number(c.aav),
      0,
    );

    const nextYearContracts = currentContracts.filter(
      (c) => c.endYear > CURRENT_SEASON_END,
    );
    const projectedNextYear = nextYearContracts.reduce(
      (s, c) => s + Number(c.aav),
      0,
    );

    const projectedCeiling = Math.round(SALARY_CAP * 1.035);

    return {
      capCeiling: SALARY_CAP,
      currentCapHit,
      capSpace: SALARY_CAP - currentCapHit,
      projectedNextYear,
      projectedCeiling,
      projectedNextYearSpace: projectedCeiling - projectedNextYear,
      contractCount: currentContracts.length,
    };
  }),
});
