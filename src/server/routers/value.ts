// ──────────────────────────────────────────────
// Roster Matrix — Value Leaderboard Router
// tRPC procedures for querying value scores
// ──────────────────────────────────────────────

import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { prisma } from "@/lib/prisma";
import { getLatestSeason } from "@/server/services/value-batch";

const positionFilter = z
  .enum(["F", "D", "G"])
  .optional()
  .describe("Position group filter");

export const valueRouter = router({
  // ── Best value contracts ──
  getTopValuePlayers: protectedProcedure
    .input(
      z.object({
        position: positionFilter,
        limit: z.number().min(1).max(100).default(25),
        season: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const season = input.season ?? (await getLatestSeason());
      return getLeaderboard(season, input.position, input.limit, "desc");
    }),

  // ── Most overpaid contracts ──
  getWorstValuePlayers: protectedProcedure
    .input(
      z.object({
        position: positionFilter,
        limit: z.number().min(1).max(100).default(25),
        season: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const season = input.season ?? (await getLatestSeason());
      return getLeaderboard(season, input.position, input.limit, "asc");
    }),

  // ── All players on a team ranked by value ──
  getValueByTeam: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        season: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const season = input.season ?? (await getLatestSeason());

      const latestScores = await prisma.playerValueScore.findMany({
        where: {
          season,
          player: { currentTeamId: input.teamId },
        },
        orderBy: { calculatedAt: "desc" },
        distinct: ["playerId"],
        include: {
          player: {
            select: {
              fullName: true,
              position: true,
              headshotUrl: true,
              nhlApiId: true,
              currentTeam: {
                select: { abbreviation: true, name: true },
              },
            },
          },
        },
      });

      const sorted = latestScores.sort(
        (a, b) => b.overallScore - a.overallScore,
      );

      return sorted.map(formatScoreRow);
    }),

  // ── Value score history for a player ──
  getValueTrend: protectedProcedure
    .input(
      z.object({
        playerId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const scores = await prisma.playerValueScore.findMany({
        where: { playerId: input.playerId },
        orderBy: { calculatedAt: "asc" },
        select: {
          season: true,
          overallScore: true,
          grade: true,
          positionGroup: true,
          aavTier: true,
          components: true,
          estimatedWAR: true,
          peerRank: true,
          leagueRank: true,
          calculatedAt: true,
        },
      });

      return scores.map((s) => ({
        season: s.season,
        overallScore: s.overallScore,
        grade: s.grade,
        positionGroup: s.positionGroup,
        aavTier: s.aavTier,
        components: s.components,
        estimatedWAR: s.estimatedWAR ? Number(s.estimatedWAR) : null,
        peerRank: s.peerRank,
        leagueRank: s.leagueRank,
        calculatedAt: s.calculatedAt,
      }));
    }),

  // ── League-wide value distribution histogram ──
  getValueDistribution: protectedProcedure
    .input(
      z.object({
        season: z.string().optional(),
        position: positionFilter,
      }),
    )
    .query(async ({ input }) => {
      const season = input.season ?? (await getLatestSeason());

      const where: Record<string, unknown> = { season };
      if (input.position) {
        where.positionGroup = input.position;
      }

      const latestScores = await prisma.playerValueScore.findMany({
        where,
        orderBy: { calculatedAt: "desc" },
        distinct: ["playerId"],
        select: { overallScore: true },
      });

      const scores = latestScores.map((s) => s.overallScore);
      scores.sort((a, b) => a - b);

      const buckets = [
        { range: "1–15 (Poor)", min: 1, max: 15, count: 0 },
        { range: "16–28 (Below Avg)", min: 16, max: 28, count: 0 },
        { range: "29–42 (Avg−)", min: 29, max: 42, count: 0 },
        { range: "43–58 (Avg+)", min: 43, max: 58, count: 0 },
        { range: "59–72 (Above Avg)", min: 59, max: 72, count: 0 },
        { range: "73–85 (Great)", min: 73, max: 85, count: 0 },
        { range: "86–99 (Elite)", min: 86, max: 99, count: 0 },
      ];

      for (const score of scores) {
        const bucket = buckets.find((b) => score >= b.min && score <= b.max);
        if (bucket) bucket.count++;
      }

      const total = scores.length;
      const average =
        total > 0
          ? Math.round(scores.reduce((sum, s) => sum + s, 0) / total)
          : 0;
      const median =
        total > 0
          ? total % 2 === 0
            ? Math.round((scores[total / 2 - 1] + scores[total / 2]) / 2)
            : scores[Math.floor(total / 2)]
          : 0;

      return { buckets, total, average, median };
    }),
});

// ── Helpers ──

async function getLeaderboard(
  season: string,
  position: "F" | "D" | "G" | undefined,
  limit: number,
  order: "asc" | "desc",
) {
  const where: Record<string, unknown> = { season };
  if (position) {
    where.positionGroup = position;
  }

  const latestScores = await prisma.playerValueScore.findMany({
    where,
    orderBy: { calculatedAt: "desc" },
    distinct: ["playerId"],
    include: {
      player: {
        select: {
          fullName: true,
          position: true,
          headshotUrl: true,
          nhlApiId: true,
          currentTeam: {
            select: { abbreviation: true, name: true },
          },
        },
      },
    },
  });

  const sorted = latestScores.sort((a, b) =>
    order === "desc"
      ? b.overallScore - a.overallScore
      : a.overallScore - b.overallScore,
  );

  return sorted.slice(0, limit).map(formatScoreRow);
}

function formatScoreRow(s: {
  id: string;
  playerId: string;
  overallScore: number;
  grade: string | null;
  positionGroup: string | null;
  aavTier: string | null;
  estimatedWAR: unknown;
  peerRank: number | null;
  leagueRank: number | null;
  season: string;
  player: {
    fullName: string;
    position: string;
    headshotUrl: string | null;
    nhlApiId: number | null;
    currentTeam: { abbreviation: string; name: string } | null;
  };
}) {
  return {
    id: s.id,
    playerId: s.playerId,
    playerName: s.player.fullName,
    position: s.player.position,
    teamAbbreviation: s.player.currentTeam?.abbreviation ?? null,
    teamName: s.player.currentTeam?.name ?? null,
    headshotUrl: s.player.headshotUrl,
    nhlApiId: s.player.nhlApiId,
    overallScore: s.overallScore,
    grade: s.grade,
    positionGroup: s.positionGroup,
    aavTier: s.aavTier,
    estimatedWAR: s.estimatedWAR ? Number(s.estimatedWAR) : null,
    peerRank: s.peerRank,
    leagueRank: s.leagueRank,
    season: s.season,
  };
}
