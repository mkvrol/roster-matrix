// ──────────────────────────────────────────────
// Roster Matrix — Trade Analyzer Router
// Backend procedures for the trade simulation tool
// ──────────────────────────────────────────────

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { protectedProcedure, router } from "../trpc";
import { prisma } from "@/lib/prisma";
import { getLatestSeason } from "@/server/services/value-batch";

const SALARY_CAP = 95_500_000;
const CURRENT_SEASON_END = 2026;

// ── Helpers ──

function getAge(birthDate: Date | null): number {
  if (!birthDate) return 27;
  const now = new Date();
  let years = now.getFullYear() - birthDate.getFullYear();
  if (
    now.getMonth() < birthDate.getMonth() ||
    (now.getMonth() === birthDate.getMonth() &&
      now.getDate() < birthDate.getDate())
  ) {
    years--;
  }
  return years;
}

async function getUserId(
  session: { user?: { email?: string | null } },
): Promise<string | null> {
  if (!session.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return user?.id ?? null;
}

// ── Router ──

export const tradeRouter = router({
  // ── Player autocomplete search ──
  searchPlayers: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        teamId: z.string().optional(),
        limit: z.number().min(1).max(20).default(10),
      }),
    )
    .query(async ({ input }) => {
      const season = await getLatestSeason();

      const where: Record<string, unknown> = {
        isActive: true,
        fullName: { contains: input.query, mode: "insensitive" },
      };
      if (input.teamId) {
        where.currentTeamId = input.teamId;
      }

      const players = await prisma.player.findMany({
        where,
        take: input.limit,
        select: {
          id: true,
          fullName: true,
          position: true,
          headshotUrl: true,
          nhlApiId: true,
          birthDate: true,
          currentTeam: { select: { id: true, abbreviation: true } },
          contracts: {
            orderBy: { startYear: "desc" as const },
            take: 1,
            select: { aav: true, endYear: true, hasNTC: true, hasNMC: true },
          },
          valueScores: {
            where: { season },
            orderBy: { calculatedAt: "desc" as const },
            take: 1,
            select: { overallScore: true, grade: true },
          },
        },
      });

      return players
        .filter((p) => p.contracts.length > 0)
        .map((p) => {
          const c = p.contracts[0];
          return {
            playerId: p.id,
            playerName: p.fullName,
            position: p.position,
            headshotUrl: p.headshotUrl,
            nhlApiId: p.nhlApiId,
            teamId: p.currentTeam?.id ?? null,
            teamAbbreviation: p.currentTeam?.abbreviation ?? null,
            aav: Number(c.aav),
            yearsRemaining: Math.max(0, c.endYear - CURRENT_SEASON_END),
            hasNTC: c.hasNTC,
            hasNMC: c.hasNMC,
            valueScore: p.valueScores[0]?.overallScore ?? null,
            grade: p.valueScores[0]?.grade ?? null,
            age: getAge(p.birthDate),
          };
        });
    }),

  // ── All teams for dropdown ──
  getTeams: protectedProcedure.query(async () => {
    return prisma.team.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        abbreviation: true,
        logoUrl: true,
        primaryColor: true,
      },
    });
  }),

  // ── User's primary team ──
  getUserTeam: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.session.user?.email) return null;
    const user = await prisma.user.findUnique({
      where: { email: ctx.session.user.email },
      select: { teamAffiliationId: true },
    });
    return user?.teamAffiliationId ?? null;
  }),

  // ── Team cap summary ──
  getTeamCap: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ input }) => {
      const contracts = await prisma.contract.findMany({
        where: {
          player: { currentTeamId: input.teamId },
          startYear: { lte: 2025 },
          endYear: { gte: CURRENT_SEASON_END },
        },
        select: { aav: true, endYear: true },
      });

      const capHit = contracts.reduce((s, c) => s + Number(c.aav), 0);

      // Projected next year
      const nextYearContracts = contracts.filter(
        (c) => c.endYear > CURRENT_SEASON_END,
      );
      const projectedNextYear = nextYearContracts.reduce(
        (s, c) => s + Number(c.aav),
        0,
      );

      return {
        capHit,
        capCeiling: SALARY_CAP,
        capSpace: SALARY_CAP - capHit,
        projectedNextYear,
        contractCount: contracts.length,
      };
    }),

  // ── Save trade scenario ──
  saveTrade: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        teams: z.record(z.unknown()),
        playersInvolved: z.array(z.unknown()),
        draftPicks: z.array(z.unknown()),
        capImpact: z.record(z.unknown()),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getUserId(ctx.session);
      if (!userId) throw new Error("User not found");

      const scenario = await prisma.tradeScenario.create({
        data: {
          userId,
          name: input.name,
          description: input.description,
          teams: input.teams as Prisma.InputJsonValue,
          playersInvolved: input.playersInvolved as Prisma.InputJsonValue,
          draftPicks: input.draftPicks as Prisma.InputJsonValue,
          capImpact: input.capImpact as Prisma.InputJsonValue,
          notes: input.notes,
        },
      });

      return { id: scenario.id };
    }),

  // ── List saved trades ──
  getSavedTrades: protectedProcedure.query(async ({ ctx }) => {
    const userId = await getUserId(ctx.session);
    if (!userId) return [];

    return prisma.tradeScenario.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
      },
    });
  }),

  // ── Auto-generated trade suggestions ──
  getSuggestedTrades: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ input }) => {
      const season = await getLatestSeason();

      // Get team roster with value scores
      const roster = await prisma.player.findMany({
        where: { currentTeamId: input.teamId, isActive: true },
        select: {
          id: true,
          fullName: true,
          position: true,
          birthDate: true,
          contracts: {
            orderBy: { startYear: "desc" as const },
            take: 1,
            select: { aav: true, endYear: true, hasNTC: true, hasNMC: true },
          },
          valueScores: {
            where: { season },
            orderBy: { calculatedAt: "desc" as const },
            take: 1,
            select: { overallScore: true, positionGroup: true },
          },
        },
      });

      // Score each position group
      const posGroupScores: Record<string, number[]> = {
        F: [],
        D: [],
        G: [],
      };
      for (const p of roster) {
        const pg = p.valueScores[0]?.positionGroup;
        if (pg && posGroupScores[pg] && p.valueScores[0]) {
          posGroupScores[pg].push(p.valueScores[0].overallScore);
        }
      }

      const posGroupAvg: Record<string, number> = {};
      for (const [pg, scores] of Object.entries(posGroupScores)) {
        posGroupAvg[pg] =
          scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 50;
      }

      // Find positions that need improvement
      const needsImprovement = Object.entries(posGroupAvg)
        .filter(([, avg]) => avg < 50)
        .map(([pg]) => pg);

      const targetPositions =
        needsImprovement.length > 0
          ? needsImprovement
          : Object.entries(posGroupAvg)
              .sort(([, a], [, b]) => a - b)
              .slice(0, 2)
              .map(([pg]) => pg);

      // Find trade targets on other teams
      const targets = await prisma.player.findMany({
        where: {
          isActive: true,
          currentTeamId: { not: input.teamId },
          valueScores: {
            some: {
              season,
              overallScore: { gte: 60 },
              positionGroup: { in: targetPositions },
            },
          },
        },
        select: {
          id: true,
          fullName: true,
          position: true,
          birthDate: true,
          currentTeam: {
            select: { id: true, abbreviation: true, name: true },
          },
          contracts: {
            orderBy: { startYear: "desc" as const },
            take: 1,
            select: { aav: true, endYear: true, hasNTC: true, hasNMC: true },
          },
          valueScores: {
            where: { season },
            orderBy: { calculatedAt: "desc" as const },
            take: 1,
            select: { overallScore: true, grade: true, positionGroup: true },
          },
        },
        take: 50,
      });

      // Filter for movable deals
      const movable = targets
        .filter((t) => {
          const c = t.contracts[0];
          if (!c) return false;
          return c.endYear - CURRENT_SEASON_END <= 3 || !c.hasNMC;
        })
        .sort((a, b) => {
          const sa = a.valueScores[0]?.overallScore ?? 0;
          const sb = b.valueScores[0]?.overallScore ?? 0;
          return sb - sa;
        })
        .slice(0, 15);

      // Find expendable players from the user's team
      const expendable = roster
        .filter((p) => {
          const c = p.contracts[0];
          const score = p.valueScores[0]?.overallScore ?? 50;
          return c && score < 45 && Number(c.aav) >= 2_000_000;
        })
        .sort(
          (a, b) =>
            (a.valueScores[0]?.overallScore ?? 50) -
            (b.valueScores[0]?.overallScore ?? 50),
        );

      // Generate trade suggestions
      const suggestions: Array<{
        id: string;
        title: string;
        description: string;
        teamAGives: Array<{
          playerId: string;
          playerName: string;
          position: string;
          aav: number;
          valueScore: number;
        }>;
        teamBGives: Array<{
          playerId: string;
          playerName: string;
          position: string;
          aav: number;
          valueScore: number;
        }>;
        teamBId: string;
        teamBName: string;
        teamBAbbreviation: string;
        netValueChange: number;
      }> = [];

      const usedExpendable = new Set<string>();

      for (const target of movable) {
        if (suggestions.length >= 5) break;
        const tc = target.contracts[0];
        if (!tc) continue;
        const targetAAV = Number(tc.aav);
        const targetScore = target.valueScores[0]?.overallScore ?? 0;

        const match = expendable.find((p) => {
          if (usedExpendable.has(p.id)) return false;
          const pAAV = Number(p.contracts[0].aav);
          return Math.abs(pAAV - targetAAV) / Math.max(targetAAV, 1) < 0.4;
        });

        if (match) {
          usedExpendable.add(match.id);
          const matchAAV = Number(match.contracts[0].aav);
          const matchScore = match.valueScores[0]?.overallScore ?? 0;
          const pg =
            target.valueScores[0]?.positionGroup ?? target.position;

          suggestions.push({
            id: `sug-${suggestions.length}`,
            title: `Acquire ${target.fullName}`,
            description: `Trade ${match.fullName} to ${target.currentTeam?.abbreviation ?? "TBD"} for ${target.fullName}. Upgrades ${pg} with a net value gain of +${targetScore - matchScore}.`,
            teamAGives: [
              {
                playerId: match.id,
                playerName: match.fullName,
                position: match.position,
                aav: matchAAV,
                valueScore: matchScore,
              },
            ],
            teamBGives: [
              {
                playerId: target.id,
                playerName: target.fullName,
                position: target.position,
                aav: targetAAV,
                valueScore: targetScore,
              },
            ],
            teamBId: target.currentTeam?.id ?? "",
            teamBName: target.currentTeam?.name ?? "",
            teamBAbbreviation: target.currentTeam?.abbreviation ?? "",
            netValueChange: targetScore - matchScore,
          });
        }
      }

      return {
        positionNeeds: targetPositions,
        positionAverages: posGroupAvg,
        suggestions,
      };
    }),
});
