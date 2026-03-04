// ──────────────────────────────────────────────
// Roster Matrix — League & Contract Explorer Router
// Backend procedures for league overview + contracts pages
// ──────────────────────────────────────────────

import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { prisma } from "@/lib/prisma";
import { getLatestSeason } from "@/server/services/value-batch";

const SALARY_CAP = 95_500_000;
const CURRENT_SEASON_START = 2025;
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

function estimateNextAAV(
  position: string,
  age: number,
  endYear: number,
  stats?: { gamesPlayed: number; points: number } | null,
  goalieStats?: { gamesPlayed: number; gamesStarted: number; savePercentage: unknown } | null,
): { low: number; mid: number; high: number } | null {
  const isGoalie = position === "G";
  const ageAtExpiry = age + Math.max(0, endYear - CURRENT_SEASON_END);
  const inflation = Math.pow(1.035, Math.max(0, endYear - CURRENT_SEASON_END));

  // Age multiplier
  let ageMult = 1.0;
  if (ageAtExpiry <= 22) ageMult = 0.80;
  else if (ageAtExpiry <= 24) ageMult = 0.90;
  else if (ageAtExpiry <= 27) ageMult = 1.00;
  else if (ageAtExpiry <= 29) ageMult = 1.02;
  else if (ageAtExpiry <= 31) ageMult = 0.92;
  else if (ageAtExpiry <= 33) ageMult = 0.80;
  else ageMult = 0.65;

  let baseMid: number;
  if (isGoalie && goalieStats) {
    const svPct = Number(goalieStats.savePercentage ?? 0.910);
    const gs = goalieStats.gamesStarted;
    if (svPct >= 0.925 && gs >= 50) baseMid = 9_000_000;
    else if (svPct >= 0.918 && gs >= 45) baseMid = 7_000_000;
    else if (svPct >= 0.912 && gs >= 35) baseMid = 5_000_000;
    else if (svPct >= 0.905) baseMid = 3_500_000;
    else baseMid = 2_000_000;
  } else if (stats && stats.gamesPlayed > 0) {
    const pointsPer82 = (stats.points / stats.gamesPlayed) * 82;
    if (position === "D") {
      if (pointsPer82 >= 60) baseMid = 9_500_000;
      else if (pointsPer82 >= 45) baseMid = 7_500_000;
      else if (pointsPer82 >= 30) baseMid = 5_000_000;
      else if (pointsPer82 >= 18) baseMid = 3_000_000;
      else baseMid = 1_500_000;
    } else {
      if (pointsPer82 >= 100) baseMid = 13_000_000;
      else if (pointsPer82 >= 80) baseMid = 10_500_000;
      else if (pointsPer82 >= 60) baseMid = 7_500_000;
      else if (pointsPer82 >= 45) baseMid = 5_500_000;
      else if (pointsPer82 >= 30) baseMid = 3_500_000;
      else baseMid = 1_500_000;
    }
    // Wing discount
    if (position === "LW" || position === "RW") baseMid = Math.round(baseMid * 0.92);
  } else {
    return null;
  }

  const mid = Math.round(baseMid * ageMult * inflation);
  return {
    low: Math.round(mid * 0.82),
    mid,
    high: Math.round(mid * 1.18),
  };
}

export const leagueRouter = router({
  // ── Team-level cap efficiency table ──
  getTeamEfficiency: protectedProcedure.query(async () => {
    const season = await getLatestSeason();

    const teams = await prisma.team.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        abbreviation: true,
        primaryColor: true,
      },
    });

    const result = await Promise.all(
      teams.map(async (team) => {
        const [contracts, scores] = await Promise.all([
          prisma.contract.findMany({
            where: {
              player: { currentTeamId: team.id },
              status: "ACTIVE",
            },
            select: { aav: true },
          }),
          prisma.playerValueScore.findMany({
            where: {
              season,
              player: { currentTeamId: team.id },
            },
            orderBy: { calculatedAt: "desc" },
            distinct: ["playerId"],
            select: { overallScore: true },
          }),
        ]);

        const totalCap = contracts.reduce(
          (s, c) => s + Number(c.aav),
          0,
        );
        const scoreValues = scores.map((s) => s.overallScore);
        const avgScore =
          scoreValues.length > 0
            ? Math.round(
                scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length,
              )
            : 0;
        const overpaid = scoreValues.filter((s) => s < 40).length;
        const underpaid = scoreValues.filter((s) => s >= 60).length;

        return {
          teamId: team.id,
          teamName: team.name,
          abbreviation: team.abbreviation,
          primaryColor: team.primaryColor,
          totalCap,
          capSpace: SALARY_CAP - totalCap,
          playerCount: scores.length,
          avgScore,
          overpaid,
          underpaid,
        };
      }),
    );

    return result;
  }),

  // ── Position market analysis ──
  getPositionMarket: protectedProcedure.query(async () => {
    const season = await getLatestSeason();

    const scores = await prisma.playerValueScore.findMany({
      where: { season },
      orderBy: { calculatedAt: "desc" },
      distinct: ["playerId"],
      include: {
        player: {
          select: {
            position: true,
            contracts: {
              orderBy: { startYear: "desc" as const },
              take: 1,
              select: { aav: true },
            },
          },
        },
      },
    });

    const positions = ["C", "LW", "RW", "D", "G"] as const;
    const result = positions.map((pos) => {
      const posScores = scores.filter(
        (s) => s.player.position === pos && s.player.contracts[0],
      );
      const aavs = posScores.map((s) => Number(s.player.contracts[0].aav));
      const vals = posScores.map((s) => s.overallScore);

      const avgAAV =
        aavs.length > 0
          ? Math.round(aavs.reduce((a, b) => a + b, 0) / aavs.length)
          : 0;
      const avgScore =
        vals.length > 0
          ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
          : 0;

      // Value efficiency = avg score per million
      const avgAAVM = avgAAV / 1_000_000 || 1;
      const efficiency = Math.round((avgScore / avgAAVM) * 10) / 10;

      // Count bargains (score >= 60 AND aav < median)
      const medianAAV = aavs.length > 0 ? aavs.sort((a, b) => a - b)[Math.floor(aavs.length / 2)] : 0;
      const bargains = posScores.filter(
        (s) =>
          s.overallScore >= 60 &&
          Number(s.player.contracts[0].aav) < medianAAV,
      ).length;

      return {
        position: pos,
        playerCount: posScores.length,
        avgAAV,
        avgScore,
        efficiency,
        bargainCount: bargains,
        medianAAV,
      };
    });

    return result;
  }),

  // ── Age vs Value scatter data ──
  getAgeCurveData: protectedProcedure.query(async () => {
    const season = await getLatestSeason();

    const scores = await prisma.playerValueScore.findMany({
      where: { season },
      orderBy: { calculatedAt: "desc" },
      distinct: ["playerId"],
      include: {
        player: {
          select: {
            birthDate: true,
            position: true,
            fullName: true,
            currentTeam: { select: { abbreviation: true } },
            contracts: {
              orderBy: { startYear: "desc" as const },
              take: 1,
              select: { aav: true },
            },
          },
        },
      },
    });

    return scores
      .filter((s) => s.player.contracts[0])
      .map((s) => ({
        playerId: s.playerId,
        playerName: s.player.fullName,
        position: s.player.position,
        teamAbbreviation: s.player.currentTeam?.abbreviation ?? null,
        age: getAge(s.player.birthDate),
        overallScore: s.overallScore,
        aav: Number(s.player.contracts[0].aav),
      }));
  }),

  // ── Cost per WAR rankings ──
  getCostPerWAR: protectedProcedure.query(async () => {
    const season = await getLatestSeason();

    const scores = await prisma.playerValueScore.findMany({
      where: {
        season,
        estimatedWAR: { gt: 0 },
        costPerWAR: { not: null },
      },
      orderBy: { calculatedAt: "desc" },
      distinct: ["playerId"],
      include: {
        player: {
          select: {
            fullName: true,
            position: true,
            currentTeamId: true,
            currentTeam: { select: { abbreviation: true } },
            contracts: {
              orderBy: { startYear: "desc" as const },
              take: 1,
              select: { aav: true },
            },
          },
        },
      },
    });

    return scores
      .filter((s) => s.player.contracts[0])
      .map((s) => ({
        playerId: s.playerId,
        playerName: s.player.fullName,
        position: s.player.position,
        teamId: s.player.currentTeamId,
        teamAbbreviation: s.player.currentTeam?.abbreviation ?? null,
        overallScore: s.overallScore,
        estimatedWAR: s.estimatedWAR ? Number(s.estimatedWAR) : 0,
        costPerWAR: s.costPerWAR ? Number(s.costPerWAR) : 0,
        aav: Number(s.player.contracts[0].aav),
      }))
      .sort((a, b) => a.costPerWAR - b.costPerWAR);
  }),

  // ── Team value distribution overlay ──
  getTeamDistribution: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ input }) => {
      const season = await getLatestSeason();

      const scores = await prisma.playerValueScore.findMany({
        where: {
          season,
          player: { currentTeamId: input.teamId },
        },
        orderBy: { calculatedAt: "desc" },
        distinct: ["playerId"],
        select: { overallScore: true },
      });

      const buckets = [
        { range: "1–15", min: 1, max: 15, count: 0 },
        { range: "16–28", min: 16, max: 28, count: 0 },
        { range: "29–42", min: 29, max: 42, count: 0 },
        { range: "43–58", min: 43, max: 58, count: 0 },
        { range: "59–72", min: 59, max: 72, count: 0 },
        { range: "73–85", min: 73, max: 85, count: 0 },
        { range: "86–99", min: 86, max: 99, count: 0 },
      ];

      for (const s of scores) {
        const b = buckets.find(
          (b) => s.overallScore >= b.min && s.overallScore <= b.max,
        );
        if (b) b.count++;
      }

      return buckets;
    }),

  // ── Contract explorer with filters ──
  getContracts: protectedProcedure
    .input(
      z.object({
        position: z.enum(["C", "LW", "RW", "D", "G"]).optional(),
        teamId: z.string().optional(),
        aavMin: z.number().optional(),
        aavMax: z.number().optional(),
        yearsRemainingMin: z.number().optional(),
        yearsRemainingMax: z.number().optional(),
        ageMin: z.number().optional(),
        ageMax: z.number().optional(),
        scoreMin: z.number().optional(),
        scoreMax: z.number().optional(),
        hasNTC: z.boolean().optional(),
        signingType: z.enum(["RFA", "UFA", "ELC", "EXTENSION"]).optional(),
        contractStatus: z.enum(["ACTIVE", "FUTURE", "EXPIRED"]).optional(),
        sortBy: z
          .enum([
            "playerName",
            "aav",
            "yearsRemaining",
            "overallScore",
            "age",
            "position",
          ])
          .default("aav"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
        page: z.number().min(1).default(1),
        perPage: z.number().min(10).max(100).default(25),
      }),
    )
    .query(async ({ input }) => {
      const season = await getLatestSeason();

      // Build contract where clause
      const contractWhere: Record<string, unknown> = {
        player: { isActive: true },
      };

      // Filter by status (default: ACTIVE + FUTURE)
      if (input.contractStatus) {
        contractWhere.status = input.contractStatus;
      } else {
        contractWhere.status = { in: ["ACTIVE", "FUTURE"] };
      }

      if (input.position) {
        (contractWhere.player as Record<string, unknown>).position =
          input.position;
      }
      if (input.teamId) {
        (contractWhere.player as Record<string, unknown>).currentTeamId =
          input.teamId;
      }
      if (input.aavMin != null || input.aavMax != null) {
        contractWhere.aav = {};
        if (input.aavMin != null)
          (contractWhere.aav as Record<string, unknown>).gte = input.aavMin;
        if (input.aavMax != null)
          (contractWhere.aav as Record<string, unknown>).lte = input.aavMax;
      }
      if (input.yearsRemainingMin != null || input.yearsRemainingMax != null) {
        contractWhere.endYear = {};
        if (input.yearsRemainingMin != null)
          (contractWhere.endYear as Record<string, unknown>).gte =
            CURRENT_SEASON_END + (input.yearsRemainingMin ?? 0);
        if (input.yearsRemainingMax != null)
          (contractWhere.endYear as Record<string, unknown>).lte =
            CURRENT_SEASON_END + (input.yearsRemainingMax ?? 10);
      }
      if (input.hasNTC != null) {
        contractWhere.hasNTC = input.hasNTC;
      }
      if (input.signingType) {
        contractWhere.signingType = input.signingType;
      }

      const contracts = await prisma.contract.findMany({
        where: contractWhere,
        include: {
          player: {
            select: {
              id: true,
              fullName: true,
              position: true,
              birthDate: true,
              headshotUrl: true,
              nhlApiId: true,
              currentTeam: { select: { abbreviation: true } },
              valueScores: {
                where: { season },
                orderBy: { calculatedAt: "desc" as const },
                take: 1,
                select: { overallScore: true, grade: true },
              },
            },
          },
        },
      });

      // Map and apply age/score filters
      let rows = contracts
        .map((c) => {
          const age = getAge(c.player.birthDate);
          return {
            contractId: c.id,
            playerId: c.player.id,
            playerName: c.player.fullName,
            position: c.player.position,
            teamAbbreviation: c.player.currentTeam?.abbreviation ?? null,
            headshotUrl: c.player.headshotUrl,
            nhlApiId: c.player.nhlApiId,
            aav: Number(c.aav),
            totalValue: Number(c.totalValue),
            startYear: c.startYear,
            endYear: c.endYear,
            yearsRemaining: Math.max(0, c.endYear - CURRENT_SEASON_END),
            structure: c.structure,
            hasNTC: c.hasNTC,
            hasNMC: c.hasNMC,
            signingType: c.signingType,
            signingAge: c.signingAge,
            age,
            overallScore: c.player.valueScores[0]?.overallScore ?? null,
            grade: c.player.valueScores[0]?.grade ?? null,
            status: c.status,
          };
        })
        .filter((r) => {
          if (input.ageMin != null && r.age < input.ageMin) return false;
          if (input.ageMax != null && r.age > input.ageMax) return false;
          if (input.scoreMin != null && (r.overallScore ?? 0) < input.scoreMin)
            return false;
          if (input.scoreMax != null && (r.overallScore ?? 100) > input.scoreMax)
            return false;
          return true;
        });

      // Sort
      rows.sort((a, b) => {
        let aVal: string | number;
        let bVal: string | number;
        switch (input.sortBy) {
          case "playerName":
            aVal = a.playerName;
            bVal = b.playerName;
            break;
          case "aav":
            aVal = a.aav;
            bVal = b.aav;
            break;
          case "yearsRemaining":
            aVal = a.yearsRemaining;
            bVal = b.yearsRemaining;
            break;
          case "overallScore":
            aVal = a.overallScore ?? 0;
            bVal = b.overallScore ?? 0;
            break;
          case "age":
            aVal = a.age;
            bVal = b.age;
            break;
          case "position":
            aVal = a.position;
            bVal = b.position;
            break;
          default:
            aVal = a.aav;
            bVal = b.aav;
        }
        if (aVal < bVal) return input.sortDir === "asc" ? -1 : 1;
        if (aVal > bVal) return input.sortDir === "asc" ? 1 : -1;
        return 0;
      });

      const total = rows.length;
      const start = (input.page - 1) * input.perPage;
      const page = rows.slice(start, start + input.perPage);

      return {
        rows: page,
        total,
        page: input.page,
        perPage: input.perPage,
        totalPages: Math.ceil(total / input.perPage),
      };
    }),

  // ── Expiring contracts board ──
  getExpiringBoard: protectedProcedure
    .input(z.object({ position: z.enum(["C", "LW", "RW", "D", "G"]).optional() }))
    .query(async ({ input }) => {
      const season = await getLatestSeason();

      const playerFilter: Record<string, unknown> = { isActive: true };
      if (input.position) {
        playerFilter.position = input.position;
      }

      const contracts = await prisma.contract.findMany({
        where: {
          endYear: {
            in: [CURRENT_SEASON_END, CURRENT_SEASON_END + 1, CURRENT_SEASON_END + 2],
          },
          player: playerFilter,
        },
        include: {
          player: {
            select: {
              id: true,
              fullName: true,
              position: true,
              birthDate: true,
              currentTeam: { select: { abbreviation: true } },
              valueScores: {
                where: { season },
                orderBy: { calculatedAt: "desc" as const },
                take: 1,
                select: { overallScore: true, grade: true },
              },
              seasonStats: {
                where: { season },
                orderBy: { season: "desc" as const },
                take: 1,
                select: { gamesPlayed: true, goals: true, assists: true, points: true },
              },
              goalieStats: {
                where: { season },
                orderBy: { season: "desc" as const },
                take: 1,
                select: { gamesPlayed: true, gamesStarted: true, savePercentage: true },
              },
            },
          },
        },
        orderBy: { aav: "desc" },
      });

      const format = (c: (typeof contracts)[number]) => {
        const age = getAge(c.player.birthDate);
        const stats = c.player.seasonStats?.[0] ?? null;
        const goalieS = c.player.goalieStats?.[0] ?? null;
        const projection = estimateNextAAV(c.player.position, age, c.endYear, stats, goalieS);
        return {
          playerId: c.player.id,
          playerName: c.player.fullName,
          position: c.player.position,
          teamAbbreviation: c.player.currentTeam?.abbreviation ?? null,
          aav: Number(c.aav),
          endYear: c.endYear,
          age,
          overallScore: c.player.valueScores[0]?.overallScore ?? null,
          grade: c.player.valueScores[0]?.grade ?? null,
          projectedAAV: projection,
        };
      };

      // Also fetch future contracts (signed deals that start after current season)
      const futureContracts = await prisma.contract.findMany({
        where: {
          status: "FUTURE",
          player: playerFilter,
        },
        include: {
          player: {
            select: {
              id: true,
              fullName: true,
              position: true,
              birthDate: true,
              currentTeam: { select: { abbreviation: true } },
            },
          },
        },
        orderBy: { aav: "desc" },
      });

      const formatFuture = (c: (typeof futureContracts)[number]) => ({
        playerId: c.player.id,
        playerName: c.player.fullName,
        position: c.player.position,
        teamAbbreviation: c.player.currentTeam?.abbreviation ?? null,
        aav: Number(c.aav),
        startYear: c.startYear,
        endYear: c.endYear,
        totalYears: c.totalYears,
        age: getAge(c.player.birthDate),
      });

      return {
        expiringThisYear: contracts
          .filter((c) => c.endYear === CURRENT_SEASON_END)
          .map(format),
        expiringNextYear: contracts
          .filter((c) => c.endYear === CURRENT_SEASON_END + 1)
          .map(format),
        extensionEligible: contracts
          .filter((c) => c.endYear === CURRENT_SEASON_END + 2)
          .map(format),
        futureContracts: futureContracts.map(formatFuture),
      };
    }),

  // ── Average AAV by position per season ──
  getAAVTrends: protectedProcedure.query(async () => {
    const stats = await prisma.seasonStats.findMany({
      select: { season: true },
      distinct: ["season"],
      orderBy: { season: "asc" },
    });

    const seasons = stats.map((s) => s.season).slice(-5);
    const positions = ["C", "LW", "RW", "D", "G"] as const;

    const result = await Promise.all(
      seasons.map(async (season) => {
        const startYear = parseInt(season.substring(0, 4));
        const endYear = parseInt(season.substring(4));

        const contracts = await prisma.contract.findMany({
          where: {
            startYear: { lte: startYear },
            endYear: { gte: endYear },
            player: { isActive: true },
          },
          select: {
            aav: true,
            player: { select: { position: true } },
          },
        });

        const byPos: Record<string, number[]> = {};
        for (const pos of positions) byPos[pos] = [];

        for (const c of contracts) {
          byPos[c.player.position]?.push(Number(c.aav));
        }

        const entry: Record<string, unknown> = {
          season,
          seasonLabel: `${season.substring(0, 4)}–${season.substring(4)}`,
        };
        for (const pos of positions) {
          const aavs = byPos[pos];
          entry[pos] =
            aavs.length > 0
              ? Math.round(
                  aavs.reduce((a, b) => a + b, 0) / aavs.length,
                )
              : 0;
        }

        return entry;
      }),
    );

    return result;
  }),

  // ── Market value calculator ──
  estimateMarketValue: protectedProcedure
    .input(
      z.object({
        position: z.enum(["C", "LW", "RW", "D", "G"]),
        age: z.number().min(18).max(45),
        gamesPlayed: z.number().min(1).max(82),
        // Skater fields
        goals: z.number().min(0).optional(),
        assists: z.number().min(0).optional(),
        points: z.number().min(0).optional(),
        // Goalie fields
        gamesStarted: z.number().min(0).optional(),
        savePercentage: z.number().min(0.800).max(1.000).optional(),
      }),
    )
    .query(({ input }) => {
      const isGoalie = input.position === "G";
      const stats = !isGoalie
        ? { gamesPlayed: input.gamesPlayed, points: input.points ?? (input.goals ?? 0) + (input.assists ?? 0) }
        : null;
      const goalieStats = isGoalie
        ? { gamesPlayed: input.gamesPlayed, gamesStarted: input.gamesStarted ?? input.gamesPlayed, savePercentage: input.savePercentage ?? 0.910 }
        : null;

      const projection = estimateNextAAV(
        input.position,
        input.age,
        CURRENT_SEASON_END, // immediate free agency
        stats,
        goalieStats,
      );

      if (!projection) {
        return { projectedAAV: null, factors: null };
      }

      // Compute some context factors
      const pointsPer82 = stats ? (stats.points / input.gamesPlayed) * 82 : 0;
      return {
        projectedAAV: projection,
        factors: {
          pointsPer82: Math.round(pointsPer82 * 10) / 10,
          age: input.age,
          position: input.position,
          isGoalie,
          savePercentage: isGoalie ? Number(goalieStats?.savePercentage ?? 0) : undefined,
        },
      };
    }),

  // ── Player explorer with filters ──
  getPlayers: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        position: z.enum(["C", "LW", "RW", "D", "G"]).optional(),
        teamId: z.string().optional(),
        sortBy: z
          .enum(["playerName", "position", "age", "aav", "overallScore"])
          .default("overallScore"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
        page: z.number().min(1).default(1),
        perPage: z.number().min(10).max(100).default(25),
      }),
    )
    .query(async ({ input }) => {
      const season = await getLatestSeason();

      // Build player where clause
      const playerWhere: Record<string, unknown> = { isActive: true };

      if (input.search) {
        playerWhere.fullName = { contains: input.search, mode: "insensitive" };
      }
      if (input.position) {
        playerWhere.position = input.position;
      }
      if (input.teamId) {
        playerWhere.currentTeamId = input.teamId;
      }

      const players = await prisma.player.findMany({
        where: playerWhere,
        select: {
          id: true,
          fullName: true,
          position: true,
          birthDate: true,
          headshotUrl: true,
          nhlApiId: true,
          currentTeam: { select: { abbreviation: true } },
          contracts: {
            orderBy: { startYear: "desc" as const },
            select: {
              aav: true,
              startYear: true,
              endYear: true,
              hasNTC: true,
              hasNMC: true,
              status: true,
            },
          },
          valueScores: {
            where: { season },
            orderBy: { calculatedAt: "desc" as const },
            take: 1,
            select: { overallScore: true, grade: true },
          },
        },
      });

      // Map to rows
      let rows = players.map((p) => {
        // Find active contract (current season), then fallback to most recent
        const activeContract = p.contracts.find(
          (c) => c.status === "ACTIVE",
        ) ?? p.contracts[0] ?? null;
        const hasFutureContract = p.contracts.some(
          (c) => c.status === "FUTURE",
        );
        return {
          playerId: p.id,
          playerName: p.fullName,
          position: p.position,
          teamAbbreviation: p.currentTeam?.abbreviation ?? null,
          headshotUrl: p.headshotUrl,
          nhlApiId: p.nhlApiId,
          age: getAge(p.birthDate),
          aav: activeContract ? Number(activeContract.aav) : 0,
          yearsRemaining: activeContract
            ? Math.max(0, activeContract.endYear - CURRENT_SEASON_END)
            : 0,
          overallScore: p.valueScores[0]?.overallScore ?? null,
          grade: p.valueScores[0]?.grade ?? null,
          hasNTC: activeContract?.hasNTC ?? false,
          hasNMC: activeContract?.hasNMC ?? false,
          hasFutureContract,
        };
      });

      // Sort
      rows.sort((a, b) => {
        let aVal: string | number;
        let bVal: string | number;
        switch (input.sortBy) {
          case "playerName":
            aVal = a.playerName;
            bVal = b.playerName;
            break;
          case "position":
            aVal = a.position;
            bVal = b.position;
            break;
          case "age":
            aVal = a.age;
            bVal = b.age;
            break;
          case "aav":
            aVal = a.aav;
            bVal = b.aav;
            break;
          case "overallScore":
            aVal = a.overallScore ?? 0;
            bVal = b.overallScore ?? 0;
            break;
          default:
            aVal = a.overallScore ?? 0;
            bVal = b.overallScore ?? 0;
        }
        if (aVal < bVal) return input.sortDir === "asc" ? -1 : 1;
        if (aVal > bVal) return input.sortDir === "asc" ? 1 : -1;
        return 0;
      });

      const total = rows.length;
      const start = (input.page - 1) * input.perPage;
      const page = rows.slice(start, start + input.perPage);

      return {
        rows: page,
        total,
        page: input.page,
        perPage: input.perPage,
        totalPages: Math.ceil(total / input.perPage),
      };
    }),

  // ── All teams (for filter dropdowns) ──
  getTeams: protectedProcedure.query(async () => {
    return prisma.team.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, abbreviation: true },
    });
  }),

  // ── Goalie market ──
  getGoalieMarket: protectedProcedure
    .input(
      z
        .object({
          roleFilter: z.enum(["starter", "backup", "all"]).default("all"),
          teamId: z.string().optional(),
          minGamesStarted: z.number().optional(),
          minSavePercentage: z.number().min(0.8).max(1.0).optional(),
          sortBy: z
            .enum([
              "savePercentage",
              "goalsAboveExpected",
              "aav",
              "valueScore",
              "gamesStarted",
            ])
            .default("valueScore"),
          sortDir: z.enum(["asc", "desc"]).default("desc"),
        })
        .optional()
        .default({}),
    )
    .query(async ({ input }) => {
      const season = await getLatestSeason();

      const playerWhere: Record<string, unknown> = {
        position: "G",
        isActive: true,
      };
      if (input.teamId) {
        playerWhere.currentTeamId = input.teamId;
      }

      const players = await prisma.player.findMany({
        where: playerWhere,
        select: {
          id: true,
          fullName: true,
          birthDate: true,
          headshotUrl: true,
          nhlApiId: true,
          currentTeam: { select: { abbreviation: true } },
          goalieStats: {
            where: { season },
            orderBy: { season: "desc" as const },
            take: 1,
          },
          contracts: {
            orderBy: { startYear: "desc" as const },
            take: 1,
            select: { aav: true, endYear: true },
          },
          valueScores: {
            where: { season },
            orderBy: { calculatedAt: "desc" as const },
            take: 1,
            select: { overallScore: true, grade: true },
          },
        },
      });

      let rows = players
        .filter((p) => p.goalieStats.length > 0)
        .map((p) => {
          const gs = p.goalieStats[0]!;
          const contract = p.contracts[0] ?? null;
          const vs = p.valueScores[0] ?? null;
          const age = getAge(p.birthDate);
          const gamesStarted = Number(gs.gamesStarted);

          return {
            playerId: p.id,
            playerName: p.fullName,
            teamAbbreviation: p.currentTeam?.abbreviation ?? null,
            headshotUrl: p.headshotUrl,
            nhlApiId: p.nhlApiId,
            age,
            aav: contract ? Number(contract.aav) : 0,
            gamesPlayed: Number(gs.gamesPlayed),
            gamesStarted,
            wins: Number(gs.wins),
            losses: Number(gs.losses),
            savePercentage: Number(gs.savePercentage),
            goalsAgainstAvg: Number(gs.goalsAgainstAvg),
            shutouts: Number(gs.shutouts),
            goalsAboveExpected: Number(gs.goalsAboveExpected),
            qualityStartPct: Number(gs.qualityStartPct),
            highDangerSavePct: Number(gs.highDangerSavePct),
            overallScore: vs?.overallScore ?? null,
            grade: vs?.grade ?? null,
            role: gamesStarted >= 40 ? ("Starter" as const) : ("Backup" as const),
            yearsRemaining: contract ? contract.endYear - CURRENT_SEASON_END : 0,
          };
        });

      // Apply filters
      if (input.roleFilter === "starter") {
        rows = rows.filter((r) => r.gamesStarted >= 40);
      } else if (input.roleFilter === "backup") {
        rows = rows.filter((r) => r.gamesStarted < 40);
      }
      if (input.minGamesStarted !== undefined) {
        rows = rows.filter((r) => r.gamesStarted >= input.minGamesStarted!);
      }
      if (input.minSavePercentage !== undefined) {
        rows = rows.filter(
          (r) => r.savePercentage >= input.minSavePercentage!,
        );
      }

      // Sort
      const sortKey =
        input.sortBy === "valueScore" ? "overallScore" : input.sortBy;
      rows.sort((a, b) => {
        const aVal = a[sortKey] ?? -Infinity;
        const bVal = b[sortKey] ?? -Infinity;
        if (aVal < bVal) return input.sortDir === "asc" ? -1 : 1;
        if (aVal > bVal) return input.sortDir === "asc" ? 1 : -1;
        return 0;
      });

      return rows;
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
});
