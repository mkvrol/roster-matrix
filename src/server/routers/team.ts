// ──────────────────────────────────────────────
// Roster Matrix — Team Page Router
// Backend procedures for team overview, roster, transactions, injuries, draft picks
// ──────────────────────────────────────────────

import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { prisma } from "@/lib/prisma";

const SALARY_CAP = 95_500_000;
const SALARY_CAP_FLOOR = 70_600_000;
const CURRENT_SEASON_END = 2026;

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

export const teamRouter = router({
  // ── Team overview with cap breakdown ──
  getOverview: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ input }) => {
      const team = await prisma.team.findUniqueOrThrow({
        where: { id: input.teamId },
        select: {
          id: true,
          name: true,
          abbreviation: true,
          primaryColor: true,
          division: true,
          conference: true,
        },
      });

      // Only count contracts covering the current season (2025-26)
      const contracts = await prisma.contract.findMany({
        where: {
          player: { currentTeamId: input.teamId, isActive: true },
          status: "ACTIVE",
          startYear: { lte: CURRENT_SEASON_END - 1 },
          endYear: { gte: CURRENT_SEASON_END },
        },
        select: {
          aav: true,
          endYear: true,
          playerId: true,
          player: { select: { position: true, fullName: true } },
        },
        orderBy: { startYear: "desc" },
      });

      // Deduplicate: keep only the latest contract per player,
      // and also deduplicate by fullName to handle duplicate player records
      const seenIds = new Set<string>();
      const seenNames = new Set<string>();
      const currentContracts = contracts.filter((c) => {
        if (seenIds.has(c.playerId)) return false;
        if (seenNames.has(c.player.fullName)) return false;
        seenIds.add(c.playerId);
        seenNames.add(c.player.fullName);
        return true;
      });

      const totalCapHit = currentContracts.reduce(
        (sum, c) => sum + Number(c.aav),
        0,
      );

      const capByPosition = { F: 0, D: 0, G: 0 };
      for (const c of currentContracts) {
        const pos = c.player.position;
        if (pos === "C" || pos === "LW" || pos === "RW") {
          capByPosition.F += Number(c.aav);
        } else if (pos === "D") {
          capByPosition.D += Number(c.aav);
        } else {
          capByPosition.G += Number(c.aav);
        }
      }

      return {
        ...team,
        cap: {
          totalCapHit,
          capFloor: SALARY_CAP_FLOOR,
          capCeiling: SALARY_CAP,
          capSpace: SALARY_CAP - totalCapHit,
          activeContracts: currentContracts.length,
          expiringThisYear: currentContracts.filter(
            (c) => c.endYear === CURRENT_SEASON_END,
          ).length,
          expiringNextYear: currentContracts.filter(
            (c) => c.endYear === CURRENT_SEASON_END + 1,
          ).length,
          projectedCapNextYear: currentContracts
            .filter((c) => c.endYear > CURRENT_SEASON_END)
            .reduce((sum, c) => sum + Number(c.aav), 0),
          projectedCapTwoYears: currentContracts
            .filter((c) => c.endYear > CURRENT_SEASON_END + 1)
            .reduce((sum, c) => sum + Number(c.aav), 0),
          capByPosition,
        },
      };
    }),

  // ── Full roster with contracts, stats, and value scores ──
  getRoster: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ input }) => {
      const players = await prisma.player.findMany({
        where: { currentTeamId: input.teamId, isActive: true },
        select: {
          id: true,
          fullName: true,
          position: true,
          birthDate: true,
          shootsCatches: true,
          contracts: {
            where: { status: "ACTIVE" },
            orderBy: { startYear: "desc" as const },
            select: {
              aav: true,
              startYear: true,
              endYear: true,
              totalYears: true,
              status: true,
              hasNTC: true,
              hasNMC: true,
            },
            take: 1,
          },
          seasonStats: {
            orderBy: { season: "desc" },
            select: {
              gamesPlayed: true,
              goals: true,
              assists: true,
              points: true,
            },
            take: 1,
          },
          goalieStats: {
            orderBy: { season: "desc" },
            select: {
              gamesPlayed: true,
              gamesStarted: true,
              wins: true,
              savePercentage: true,
              goalsAgainstAvg: true,
            },
            take: 1,
          },
          valueScores: {
            orderBy: { calculatedAt: "desc" },
            select: {
              overallScore: true,
              grade: true,
            },
            take: 1,
          },
        },
      });

      const roster = players.map((p) => {
        const contract = p.contracts[0] ?? null;
        const age = getAge(p.birthDate);
        const yearsRemaining = contract
          ? contract.endYear - CURRENT_SEASON_END
          : 0;
        const isGoalie = p.position === "G";

        return {
          id: p.id,
          fullName: p.fullName,
          position: p.position,
          shootsCatches: p.shootsCatches,
          age,
          contract: contract
            ? {
                aav: Number(contract.aav),
                startYear: contract.startYear,
                endYear: contract.endYear,
                totalYears: contract.totalYears,
                status: contract.status,
                hasNTC: contract.hasNTC,
                hasNMC: contract.hasNMC,
              }
            : null,
          yearsRemaining,
          stats: isGoalie
            ? null
            : p.seasonStats[0]
              ? {
                  gamesPlayed: p.seasonStats[0].gamesPlayed,
                  goals: p.seasonStats[0].goals,
                  assists: p.seasonStats[0].assists,
                  points: p.seasonStats[0].points,
                }
              : null,
          goalieStats: isGoalie
            ? p.goalieStats[0]
              ? {
                  gamesPlayed: p.goalieStats[0].gamesPlayed,
                  gamesStarted: p.goalieStats[0].gamesStarted,
                  wins: p.goalieStats[0].wins,
                  savePercentage: Number(p.goalieStats[0].savePercentage),
                  goalsAgainstAvg: Number(p.goalieStats[0].goalsAgainstAvg),
                }
              : null
            : null,
          value: p.valueScores[0]
            ? {
                overallScore: p.valueScores[0].overallScore,
                grade: p.valueScores[0].grade,
              }
            : null,
        };
      });

      // Sort: Forwards (by points desc), Defensemen (by points desc), Goalies (by GP desc)
      const forwards = roster
        .filter((p) => ["C", "LW", "RW"].includes(p.position))
        .sort((a, b) => (b.stats?.points ?? 0) - (a.stats?.points ?? 0));
      const defensemen = roster
        .filter((p) => p.position === "D")
        .sort((a, b) => (b.stats?.points ?? 0) - (a.stats?.points ?? 0));
      const goalies = roster
        .filter((p) => p.position === "G")
        .sort(
          (a, b) =>
            (b.goalieStats?.gamesPlayed ?? 0) -
            (a.goalieStats?.gamesPlayed ?? 0),
        );

      return [...forwards, ...defensemen, ...goalies];
    }),

  // ── Recent transactions ──
  getTransactions: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ input }) => {
      return prisma.transaction.findMany({
        where: { teamId: input.teamId },
        orderBy: { date: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          description: true,
          playersInvolved: true,
          date: true,
        },
      });
    }),

  // ── Current injuries ──
  getInjuries: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ input }) => {
      return prisma.injury.findMany({
        where: { teamId: input.teamId },
        select: {
          id: true,
          type: true,
          description: true,
          date: true,
          expectedReturn: true,
          player: {
            select: {
              id: true,
              fullName: true,
              position: true,
            },
          },
        },
      });
    }),

  // ── Draft picks: owned vs traded away ──
  getDraftPicks: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ input }) => {
      const [owned, tradedAway] = await Promise.all([
        prisma.draftPick.findMany({
          where: {
            teamId: input.teamId,
            year: { gte: 2025, lte: 2027 },
          },
          include: {
            originalTeam: { select: { abbreviation: true } },
          },
        }),
        prisma.draftPick.findMany({
          where: {
            originalTeamId: input.teamId,
            teamId: { not: input.teamId },
            year: { gte: 2025, lte: 2027 },
          },
          include: {
            team: { select: { abbreviation: true } },
          },
        }),
      ]);

      return {
        owned: owned.map((p) => ({
          id: p.id,
          year: p.year,
          round: p.round,
          condition: p.condition,
          isOwn: p.teamId === p.originalTeamId,
          originalTeamAbbrev: p.originalTeam.abbreviation,
        })),
        tradedAway: tradedAway.map((p) => ({
          id: p.id,
          year: p.year,
          round: p.round,
          condition: p.condition,
          isOwn: false,
          tradedToAbbrev: p.team.abbreviation,
        })),
      };
    }),
});
