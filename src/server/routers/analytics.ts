// ──────────────────────────────────────────────
// Roster Matrix — Analytics Router
// Admin-only procedures for the analytics dashboard
// ──────────────────────────────────────────────

import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../trpc";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "../services/analytics";
import type { AnalyticsEventType } from "../services/analytics";

// ── Helpers ──

function getDateFilter(range: string): Date {
  const now = new Date();
  switch (range) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "month":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(0); // all time
  }
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

export const analyticsRouter = router({
  // ── Track an event from the client ──
  track: protectedProcedure
    .input(
      z.object({
        eventType: z.string(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getUserId(ctx.session);
      trackEvent(
        input.eventType as AnalyticsEventType,
        userId,
        input.metadata as Record<string, unknown>,
      );
      return { ok: true };
    }),

  // ── Dashboard data (admin only) ──
  getDashboard: adminProcedure
    .input(z.object({ range: z.enum(["today", "week", "month", "all"]) }))
    .query(async ({ input }) => {
      const since = getDateFilter(input.range);

      // Overview cards
      const [totalPageViews, uniqueUsers, totalAIQueries, mostActiveUser] =
        await Promise.all([
          prisma.analyticsEvent.count({
            where: { eventType: "PAGE_VIEW", timestamp: { gte: since } },
          }),
          prisma.analyticsEvent
            .groupBy({
              by: ["userId"],
              where: { timestamp: { gte: since }, userId: { not: null } },
            })
            .then((rows) => rows.length),
          prisma.analyticsEvent.count({
            where: {
              eventType: {
                in: [
                  "AI_SCOUT_QUERY",
                  "AI_BRIEFING_GENERATED",
                  "AI_NEGOTIATION_VIEWED",
                ],
              },
              timestamp: { gte: since },
            },
          }),
          prisma.analyticsEvent
            .groupBy({
              by: ["userId"],
              where: { timestamp: { gte: since }, userId: { not: null } },
              _count: { id: true },
              orderBy: { _count: { id: "desc" } },
              take: 1,
            })
            .then(async (rows) => {
              if (!rows[0]?.userId) return null;
              const user = await prisma.user.findUnique({
                where: { id: rows[0].userId },
                select: { name: true, email: true },
              });
              return user
                ? { name: user.name ?? user.email, count: rows[0]._count.id }
                : null;
            }),
        ]);

      // Most viewed players (top 20)
      const playerViewRows = await prisma.analyticsEvent.groupBy({
        by: ["metadata"],
        where: {
          eventType: "PLAYER_VIEW",
          timestamp: { gte: since },
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 100,
      });

      // Aggregate by playerId from metadata
      const playerCounts: Record<
        string,
        { name: string; team: string; count: number }
      > = {};
      for (const row of playerViewRows) {
        const meta = row.metadata as Record<string, unknown> | null;
        const pid = meta?.playerId as string | undefined;
        const name = meta?.playerName as string | undefined;
        const team = meta?.teamAbbrev as string | undefined;
        if (!pid || !name) continue;
        if (!playerCounts[pid]) {
          playerCounts[pid] = { name, team: team ?? "", count: 0 };
        }
        playerCounts[pid].count += row._count.id;
      }
      const topPlayers = Object.entries(playerCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 20)
        .map(([playerId, data]) => ({
          playerId,
          playerName: data.name,
          teamAbbrev: data.team,
          views: data.count,
        }));

      // Most viewed teams (top 10)
      const teamViewRows = await prisma.analyticsEvent.groupBy({
        by: ["metadata"],
        where: {
          eventType: "TEAM_VIEW",
          timestamp: { gte: since },
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 50,
      });

      const teamCounts: Record<string, { name: string; count: number }> = {};
      for (const row of teamViewRows) {
        const meta = row.metadata as Record<string, unknown> | null;
        const abbrev = meta?.teamAbbrev as string | undefined;
        const name = meta?.teamName as string | undefined;
        if (!abbrev) continue;
        if (!teamCounts[abbrev]) {
          teamCounts[abbrev] = { name: name ?? abbrev, count: 0 };
        }
        teamCounts[abbrev].count += row._count.id;
      }
      const topTeams = Object.entries(teamCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([abbrev, data]) => ({
          teamAbbrev: abbrev,
          teamName: data.name,
          views: data.count,
        }));

      // Feature usage breakdown
      const featureTypes: Record<string, string> = {
        TRADE_SAVED: "Trade Analyzer",
        AI_SCOUT_QUERY: "AI Scout",
        AI_BRIEFING_GENERATED: "Briefing",
        COMPARISON_CREATED: "Compare",
        WATCHLIST_ADDED: "Watchlist",
        REPORT_EXPORTED: "Reports",
      };
      const featureRows = await prisma.analyticsEvent.groupBy({
        by: ["eventType"],
        where: {
          eventType: { in: Object.keys(featureTypes) },
          timestamp: { gte: since },
        },
        _count: { id: true },
      });
      const featureUsage = Object.entries(featureTypes).map(
        ([eventType, label]) => ({
          feature: label,
          count:
            featureRows.find((r) => r.eventType === eventType)?._count.id ?? 0,
        }),
      );

      // AI usage over time (daily)
      const aiEvents = await prisma.analyticsEvent.findMany({
        where: {
          eventType: {
            in: [
              "AI_SCOUT_QUERY",
              "AI_BRIEFING_GENERATED",
              "AI_NEGOTIATION_VIEWED",
            ],
          },
          timestamp: { gte: since },
        },
        select: { timestamp: true },
        orderBy: { timestamp: "asc" },
      });
      const aiByDay: Record<string, number> = {};
      for (const e of aiEvents) {
        const day = e.timestamp.toISOString().slice(0, 10);
        aiByDay[day] = (aiByDay[day] ?? 0) + 1;
      }
      const aiTimeline = Object.entries(aiByDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));

      // Top AI query themes
      const scoutQueries = await prisma.analyticsEvent.findMany({
        where: {
          eventType: "AI_SCOUT_QUERY",
          timestamp: { gte: since },
        },
        select: { metadata: true },
        orderBy: { timestamp: "desc" },
        take: 200,
      });
      const queryCounts: Record<string, number> = {};
      for (const e of scoutQueries) {
        const meta = e.metadata as Record<string, unknown> | null;
        const q = (meta?.query as string)?.toLowerCase().trim();
        if (!q) continue;
        queryCounts[q] = (queryCounts[q] ?? 0) + 1;
      }
      const topQueries = Object.entries(queryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([query, count]) => ({ query, count }));

      // Search analytics
      const searchEvents = await prisma.analyticsEvent.findMany({
        where: {
          eventType: "SEARCH",
          timestamp: { gte: since },
        },
        select: { metadata: true },
        orderBy: { timestamp: "desc" },
        take: 300,
      });
      const searchCounts: Record<string, number> = {};
      for (const e of searchEvents) {
        const meta = e.metadata as Record<string, unknown> | null;
        const q = (meta?.query as string)?.toLowerCase().trim();
        if (!q) continue;
        searchCounts[q] = (searchCounts[q] ?? 0) + 1;
      }
      const topSearches = Object.entries(searchCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([query, count]) => ({ query, count }));

      return {
        overview: {
          totalPageViews,
          uniqueUsers,
          totalAIQueries,
          mostActiveUser,
        },
        topPlayers,
        topTeams,
        featureUsage,
        aiTimeline,
        topQueries,
        topSearches,
      };
    }),
});
