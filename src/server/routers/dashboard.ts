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

  // ── Recent league-wide transactions ──
  getRecentTransactions: protectedProcedure.query(async () => {
    const raw = await prisma.transaction.findMany({
      orderBy: { date: "desc" },
      take: 60,
      select: {
        id: true,
        type: true,
        description: true,
        playersInvolved: true,
        date: true,
        team: { select: { id: true, name: true, abbreviation: true } },
      },
    });

    // Separate trade-sync (already structured) from roster-sync trades
    const result: typeof raw = [];
    const rosterTrades: (typeof raw)[number][] = [];
    const usedIds = new Set<string>();

    for (const tx of raw) {
      if (tx.type !== "TRADE") {
        result.push(tx);
        continue;
      }

      // Trade-sync format has team1/team2 with sends arrays
      const involved = tx.playersInvolved as Record<string, unknown> | null;
      if (involved && typeof involved === "object" && "team1" in involved && "team2" in involved) {
        result.push(tx);
        usedIds.add(tx.id);
        continue;
      }

      // Roster-sync trade — collect for merging
      rosterTrades.push(tx);
    }

    // Merge roster-sync trades: group by date + team pair
    // Extract player name and from/to team from description formats:
    //   "PlayerName traded from AAA to BBB"
    //   "Acquired PlayerName from TeamName"
    //   "Traded PlayerName to TeamName"
    type ParsedRosterTrade = {
      tx: (typeof raw)[number];
      playerName: string;
      fromAbbrev: string;
      toAbbrev: string;
      dateKey: string;
    };

    const parsed: ParsedRosterTrade[] = [];
    for (const tx of rosterTrades) {
      const dateKey = new Date(tx.date).toISOString().slice(0, 10);
      const desc = tx.description;

      const newFmt = desc.match(/^(.+?)\s+traded from\s+(\w{2,3})\s+to\s+(\w{2,3})/);
      if (newFmt) {
        parsed.push({ tx, playerName: newFmt[1], fromAbbrev: newFmt[2], toAbbrev: newFmt[3], dateKey });
        continue;
      }

      const acqFmt = desc.match(/^Acquired\s+(.+?)\s+from\s+(.+)$/);
      if (acqFmt) {
        // "to" team is this transaction's team
        const fromPair = rosterTrades.find(
          (o) => o.id !== tx.id && o.type === "TRADE" &&
            o.description.includes(acqFmt[1]) &&
            new Date(o.date).toISOString().slice(0, 10) === dateKey,
        );
        const fromAbbrev = fromPair?.team.abbreviation ?? acqFmt[2].slice(0, 3).toUpperCase();
        parsed.push({ tx, playerName: acqFmt[1], fromAbbrev, toAbbrev: tx.team.abbreviation, dateKey });
        continue;
      }

      const trdFmt = desc.match(/^Traded\s+(.+?)\s+to\s+(.+)$/);
      if (trdFmt) {
        const toPair = rosterTrades.find(
          (o) => o.id !== tx.id && o.type === "TRADE" &&
            o.description.includes(trdFmt[1]) &&
            new Date(o.date).toISOString().slice(0, 10) === dateKey,
        );
        const toAbbrev = toPair?.team.abbreviation ?? trdFmt[2].slice(0, 3).toUpperCase();
        parsed.push({ tx, playerName: trdFmt[1], fromAbbrev: tx.team.abbreviation, toAbbrev, dateKey });
        continue;
      }

      // Unknown format — pass through
      result.push(tx);
    }

    // Group by date + sorted team pair to find multi-player swaps
    const tradeGroups = new Map<string, ParsedRosterTrade[]>();
    for (const p of parsed) {
      const teamPair = [p.fromAbbrev, p.toAbbrev].sort().join("-");
      const key = `${p.dateKey}::${teamPair}`;
      const group = tradeGroups.get(key) ?? [];
      group.push(p);
      tradeGroups.set(key, group);
    }

    for (const [, group] of Array.from(tradeGroups)) {
      // Pick the two teams
      const teamA = group[0].fromAbbrev;
      const teamB = group[0].toAbbrev;

      // Players team A sends (went from A to B) — deduplicate
      const teamASends = Array.from(new Set(
        group
          .filter((p: ParsedRosterTrade) => p.fromAbbrev === teamA)
          .map((p: ParsedRosterTrade) => p.playerName),
      ));
      // Players team B sends (went from B to A) — deduplicate
      const teamBSends = Array.from(new Set(
        group
          .filter((p: ParsedRosterTrade) => p.fromAbbrev === teamB)
          .map((p: ParsedRosterTrade) => p.playerName),
      ));

      const firstTx = group[0].tx;
      result.push({
        ...firstTx,
        description: firstTx.description,
        playersInvolved: {
          team1: { abbreviation: teamA, name: teamA, sends: teamASends },
          team2: { abbreviation: teamB, name: teamB, sends: teamBSends },
        },
      });
    }

    // Sort by date descending
    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return result.slice(0, 25);
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
