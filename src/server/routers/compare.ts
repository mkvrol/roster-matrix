// ──────────────────────────────────────────────
// Roster Matrix — Player Comparison Router
// Backend procedures for side-by-side player comparison
// ──────────────────────────────────────────────

import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { prisma } from "@/lib/prisma";
import { getLatestSeason } from "@/server/services/value-batch";

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

// ── Router ──

export const compareRouter = router({
  getComparison: protectedProcedure
    .input(
      z.object({
        playerIds: z.array(z.string()).min(2).max(4),
      }),
    )
    .query(async ({ input }) => {
      const season = await getLatestSeason();

      const players = await Promise.all(
        input.playerIds.map((id) =>
          prisma.player.findUniqueOrThrow({
            where: { id },
            include: {
              currentTeam: { select: { abbreviation: true } },
              contracts: {
                orderBy: { startYear: "desc" as const },
                take: 1,
              },
              seasonStats: { where: { season }, take: 1 },
              advancedStats: { where: { season }, take: 1 },
              goalieStats: { where: { season }, take: 1 },
              valueScores: {
                orderBy: { calculatedAt: "desc" as const },
                take: 1,
              },
            },
          }),
        ),
      );

      return players.map((player) => {
        const contract = player.contracts[0] ?? null;
        const stats = player.seasonStats[0] ?? null;
        const advanced = player.advancedStats[0] ?? null;
        const goalie = player.goalieStats[0] ?? null;
        const value = player.valueScores[0] ?? null;
        const age = getAge(player.birthDate);

        return {
          id: player.id,
          fullName: player.fullName,
          position: player.position,
          headshotUrl: player.headshotUrl,
          nhlApiId: player.nhlApiId,
          teamAbbreviation: player.currentTeam?.abbreviation ?? null,
          age,
          contract: contract
            ? {
                aav: Number(contract.aav),
                totalValue: Number(contract.totalValue),
                totalYears: contract.totalYears,
                startYear: contract.startYear,
                endYear: contract.endYear,
                yearsRemaining: Math.max(
                  0,
                  contract.endYear - CURRENT_SEASON_END,
                ),
                hasNTC: contract.hasNTC,
                hasNMC: contract.hasNMC,
                signingType: contract.signingType,
              }
            : null,
          seasonStats: stats
            ? {
                gamesPlayed: stats.gamesPlayed,
                goals: stats.goals,
                assists: stats.assists,
                points: stats.points,
                plusMinus: stats.plusMinus,
                pim: stats.pim,
                toiPerGame: stats.toiPerGame
                  ? Number(stats.toiPerGame)
                  : null,
                shots: stats.shots,
                hits: stats.hits,
                blocks: stats.blocks,
              }
            : null,
          advancedStats: advanced
            ? {
                corsiForPct: advanced.corsiForPct
                  ? Number(advanced.corsiForPct)
                  : null,
                xGFPct: advanced.xGFPct ? Number(advanced.xGFPct) : null,
                goalsForPct: advanced.goalsForPct
                  ? Number(advanced.goalsForPct)
                  : null,
              }
            : null,
          goalieStats:
            player.position === "G" && goalie
              ? {
                  gamesPlayed: goalie.gamesPlayed,
                  wins: goalie.wins,
                  savePercentage: goalie.savePercentage
                    ? Number(goalie.savePercentage)
                    : null,
                  goalsAgainstAvg: goalie.goalsAgainstAvg
                    ? Number(goalie.goalsAgainstAvg)
                    : null,
                  shutouts: goalie.shutouts,
                }
              : null,
          valueScore: value
            ? {
                overallScore: value.overallScore,
                grade: value.grade,
                components: value.components as Record<string, unknown> | null,
                scoringComponent: value.scoringComponent
                  ? Number(value.scoringComponent)
                  : null,
                fiveOnFiveComponent: value.fiveOnFiveComponent
                  ? Number(value.fiveOnFiveComponent)
                  : null,
                specialTeamsComponent: value.specialTeamsComponent
                  ? Number(value.specialTeamsComponent)
                  : null,
                durabilityComponent: value.durabilityComponent
                  ? Number(value.durabilityComponent)
                  : null,
                efficiencyComponent: value.efficiencyComponent
                  ? Number(value.efficiencyComponent)
                  : null,
                ageCurveComponent: value.ageCurveComponent
                  ? Number(value.ageCurveComponent)
                  : null,
                estimatedWAR: value.estimatedWAR
                  ? Number(value.estimatedWAR)
                  : null,
                costPerWAR: value.costPerWAR
                  ? Number(value.costPerWAR)
                  : null,
                leagueRank: value.leagueRank,
              }
            : null,
        };
      });
    }),

  searchPlayers: protectedProcedure
    .input(
      z.object({
        query: z.string(),
        limit: z.number().optional(),
      }),
    )
    .query(async ({ input }) => {
      const limit = input.limit ?? 8;

      const players = await prisma.player.findMany({
        where: {
          isActive: true,
          fullName: { contains: input.query, mode: "insensitive" },
        },
        take: limit,
        select: {
          id: true,
          fullName: true,
          position: true,
          headshotUrl: true,
          nhlApiId: true,
          currentTeam: { select: { abbreviation: true } },
        },
      });

      return players.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        position: p.position,
        teamAbbreviation: p.currentTeam?.abbreviation ?? null,
        headshotUrl: p.headshotUrl,
        nhlApiId: p.nhlApiId,
      }));
    }),
});
