// ──────────────────────────────────────────────
// Roster Matrix — Saved Reports Router
// Backend procedures for generating and managing saved reports
// ──────────────────────────────────────────────

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { protectedProcedure, router } from "../trpc";
import { prisma } from "@/lib/prisma";
import { getLatestSeason } from "@/server/services/value-batch";
import {
  getPositionGroup,
  projectNextContract,
  findComparableContracts,
} from "@/lib/value-engine";
import type { Position, ValueInput } from "@/lib/value-engine";
import { trackEvent } from "../services/analytics";

const CURRENT_SEASON_END = 2026;

// ── Helpers ──

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

function generateGMNote(
  playerName: string,
  age: number,
  score: { overallScore: number; grade: string | null } | null,
  contractAav: number,
  contractEndYear: number,
  stats: { gamesPlayed: number; points: number } | null,
): string {
  if (!score) {
    return `${playerName} does not have a calculated value score yet.`;
  }

  const aavM = contractAav / 1_000_000;
  const yearsLeft = Math.max(0, contractEndYear - CURRENT_SEASON_END);

  let verb: string;
  if (score.overallScore >= 75) verb = "significantly outperforming";
  else if (score.overallScore >= 60) verb = "outperforming";
  else if (score.overallScore >= 45) verb = "producing at fair value for";
  else if (score.overallScore >= 30) verb = "underperforming";
  else verb = "significantly underperforming";

  let note = `${playerName} is ${verb} his $${aavM.toFixed(1)}M contract with a value score of ${score.overallScore} (${score.grade}).`;

  if (age <= 23)
    note += ` At ${age}, he is in the early stages of his career with significant upside potential.`;
  else if (age <= 27)
    note += ` At ${age}, he is entering or in his prime years.`;
  else if (age <= 30)
    note += ` At ${age}, he is in his peak earning window.`;
  else
    note += ` At ${age}, age-related decline is a factor in future projections.`;

  if (stats && stats.gamesPlayed > 0) {
    const ppg = (stats.points / stats.gamesPlayed).toFixed(2);
    note += ` He has ${stats.points} points in ${stats.gamesPlayed} games (${ppg} P/GP) this season.`;
  }

  if (yearsLeft <= 1)
    note += ` His contract expires this off-season, making him a key decision point.`;
  else if (yearsLeft === 2)
    note += ` With ${yearsLeft} years remaining, extension discussions should begin soon.`;
  else note += ` He has ${yearsLeft} years remaining on his current deal.`;

  return note;
}

// ── Router ──

export const reportRouter = router({
  // ── List user's saved reports ──
  getReports: protectedProcedure.query(async ({ ctx }) => {
    const userId = await getUserId(ctx.session);
    if (!userId) return [];

    return prisma.savedReport.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        type: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }),

  // ── Get single report with full configuration ──
  getReport: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = await getUserId(ctx.session);
      if (!userId) return null;

      return prisma.savedReport.findFirst({
        where: { id: input.id, userId },
      });
    }),

  // ── Generate player evaluation report ──
  generatePlayerReport: protectedProcedure
    .input(
      z.object({
        playerId: z.string(),
        title: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getUserId(ctx.session);
      if (!userId) throw new Error("User not found");

      const season = await getLatestSeason();

      const player = await prisma.player.findUniqueOrThrow({
        where: { id: input.playerId },
        include: {
          currentTeam: true,
          contracts: {
            orderBy: { startYear: "desc" as const },
            take: 1,
          },
          seasonStats: {
            where: { season },
            take: 1,
          },
          goalieStats: {
            where: { season },
            take: 1,
          },
          advancedStats: {
            where: { season },
            take: 1,
          },
          valueScores: {
            orderBy: { calculatedAt: "desc" as const },
            take: 1,
          },
        },
      });

      const contract = player.contracts[0];
      const stats = player.seasonStats[0];
      const goalie = player.goalieStats?.[0];
      const advanced = player.advancedStats[0];
      const score = player.valueScores[0];
      const age = getAge(player.birthDate);

      // Build league + peer rank
      let leagueRank: number | null = null;
      let peerRank: number | null = null;

      if (score) {
        const allScores = await prisma.playerValueScore.findMany({
          where: { season },
          orderBy: { calculatedAt: "desc" },
          distinct: ["playerId" as const],
          select: { playerId: true, overallScore: true },
        });
        allScores.sort((a, b) => b.overallScore - a.overallScore);
        const leagueIdx = allScores.findIndex(
          (s) => s.playerId === input.playerId,
        );
        if (leagueIdx >= 0) leagueRank = leagueIdx + 1;

        const peerScores = await prisma.playerValueScore.findMany({
          where: { season, positionGroup: score.positionGroup },
          orderBy: { calculatedAt: "desc" },
          distinct: ["playerId" as const],
          select: { playerId: true, overallScore: true },
        });
        peerScores.sort((a, b) => b.overallScore - a.overallScore);
        const peerIdx = peerScores.findIndex(
          (s) => s.playerId === input.playerId,
        );
        if (peerIdx >= 0) peerRank = peerIdx + 1;
      }

      const gmNote = generateGMNote(
        player.fullName,
        age,
        score ?? null,
        contract ? Number(contract.aav) : 0,
        contract?.endYear ?? CURRENT_SEASON_END,
        stats
          ? { gamesPlayed: stats.gamesPlayed, points: stats.points }
          : null,
      );

      // Build ValueInput for projection + comparables
      let projection: {
        projectedAAV: { low: number; mid: number; high: number };
        projectedTerm: { low: number; mid: number; high: number };
        confidence: number;
        comparables: Array<{
          playerName: string;
          aav: number;
          term: number;
          ageAtSigning: number;
          productionAtSigning: number;
        }>;
      } | null = null;

      let comparables: {
        rank: number;
        percentile: number;
        summary: string;
        peers: Array<{
          playerName: string;
          position: string;
          age: number;
          aav: number;
          totalYears: number;
          valueScore: number;
          points: number;
          gamesPlayed: number;
        }>;
      } | null = null;

      if (contract) {
        const posGroup = getPositionGroup(player.position as Position);
        const valueInput: ValueInput = {
          player: { position: player.position as Position, age },
          contract: {
            aav: Number(contract.aav),
            totalYears: contract.totalYears,
            startYear: contract.startYear,
            endYear: contract.endYear,
            hasNTC: contract.hasNTC,
            hasNMC: contract.hasNMC,
            signingType: contract.signingType ?? undefined,
            signingAge: contract.signingAge ?? undefined,
          },
        };

        if (posGroup === "G" && goalie) {
          valueInput.goalie = {
            gamesPlayed: goalie.gamesPlayed,
            gamesStarted: goalie.gamesStarted,
            wins: goalie.wins,
            losses: goalie.losses,
            otLosses: goalie.otLosses,
            savePercentage: Number(goalie.savePercentage ?? 0.9),
            goalsAgainstAvg: Number(goalie.goalsAgainstAvg ?? 3.0),
            shotsAgainst: goalie.shotsAgainst,
            saves: goalie.saves,
            shutouts: goalie.shutouts,
            qualityStarts: goalie.qualityStarts ?? undefined,
            qualityStartPct: goalie.qualityStartPct
              ? Number(goalie.qualityStartPct)
              : undefined,
            goalsAboveExpected: goalie.goalsAboveExpected
              ? Number(goalie.goalsAboveExpected)
              : undefined,
            highDangerSavePct: goalie.highDangerSavePct
              ? Number(goalie.highDangerSavePct)
              : undefined,
          };
        } else if (stats) {
          valueInput.stats = {
            gamesPlayed: stats.gamesPlayed,
            goals: stats.goals,
            assists: stats.assists,
            points: stats.points,
            plusMinus: stats.plusMinus,
            pim: stats.pim,
            toiPerGame: Number(stats.toiPerGame ?? 16),
            shots: stats.shots,
            shootingPct: Number(stats.shootingPct ?? 10),
            hits: stats.hits,
            blocks: stats.blocks,
            takeaways: stats.takeaways,
            giveaways: stats.giveaways,
            faceoffPct: stats.faceoffPct
              ? Number(stats.faceoffPct)
              : undefined,
            gameWinningGoals: stats.gameWinningGoals,
            overtimeGoals: stats.overtimeGoals,
            powerPlayGoals: stats.powerPlayGoals,
            powerPlayAssists: stats.powerPlayAssists,
            powerPlayPoints: stats.powerPlayPoints,
            powerPlayToi: stats.powerPlayToi
              ? Number(stats.powerPlayToi)
              : undefined,
            shortHandedGoals: stats.shortHandedGoals,
            shortHandedAssists: stats.shortHandedAssists,
            shortHandedPoints: stats.shortHandedPoints,
            shortHandedToi: stats.shortHandedToi
              ? Number(stats.shortHandedToi)
              : undefined,
            evenStrengthGoals: stats.evenStrengthGoals,
            evenStrengthAssists: stats.evenStrengthAssists,
            evenStrengthPoints: stats.evenStrengthPoints,
          };

          if (advanced) {
            valueInput.advanced = {
              corsiForPct: advanced.corsiForPct
                ? Number(advanced.corsiForPct)
                : undefined,
              xGFPct: advanced.xGFPct ? Number(advanced.xGFPct) : undefined,
              goalsForPct: advanced.goalsForPct
                ? Number(advanced.goalsForPct)
                : undefined,
              relCorsiForPct: advanced.relCorsiForPct
                ? Number(advanced.relCorsiForPct)
                : undefined,
              individualExpectedGoals: advanced.individualExpectedGoals
                ? Number(advanced.individualExpectedGoals)
                : undefined,
              individualHighDangerChances:
                advanced.individualHighDangerChances ?? undefined,
              defensiveZoneStartPct: advanced.defensiveZoneStartPct
                ? Number(advanced.defensiveZoneStartPct)
                : undefined,
              offensiveZoneStartPct: advanced.offensiveZoneStartPct
                ? Number(advanced.offensiveZoneStartPct)
                : undefined,
            };
          }
        }

        try {
          const proj = await projectNextContract(valueInput, prisma);
          projection = {
            projectedAAV: proj.projectedAAV,
            projectedTerm: proj.projectedTerm,
            confidence: proj.confidence,
            comparables: proj.comparables,
          };
        } catch {
          // Projection may fail without enough data
        }

        try {
          const result = await findComparableContracts(valueInput, prisma, {
            aavTolerancePct: 20,
            ageToleranceYears: 3,
            maxResults: 15,
            season,
          });
          comparables = {
            rank: result.rank,
            percentile: result.percentile,
            summary: result.summary,
            peers: result.peers.map((p) => ({
              playerName: p.playerName,
              position: p.position,
              age: p.age,
              aav: p.aav,
              totalYears: p.totalYears,
              valueScore: p.valueScore,
              points: p.points,
              gamesPlayed: p.gamesPlayed,
            })),
          };
        } catch {
          // Comparables may fail without enough data
        }
      }

      const configuration: Record<string, unknown> = {
        player: {
          fullName: player.fullName,
          position: player.position,
          age,
          team: player.currentTeam?.name ?? null,
          headshotUrl: player.headshotUrl ?? null,
        },
        valueScore: score
          ? {
              overallScore: score.overallScore,
              grade: score.grade,
              components: score.components as Prisma.JsonValue,
              estimatedWAR: score.estimatedWAR
                ? Number(score.estimatedWAR)
                : null,
              leagueRank,
              peerRank,
            }
          : null,
        contract: contract
          ? {
              aav: Number(contract.aav),
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
        stats: stats
          ? {
              gamesPlayed: stats.gamesPlayed,
              goals: stats.goals,
              assists: stats.assists,
              points: stats.points,
              plusMinus: stats.plusMinus,
              toiPerGame: stats.toiPerGame
                ? Number(stats.toiPerGame)
                : null,
            }
          : null,
        advanced: advanced
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
        goalieStats: goalie
          ? {
              gamesPlayed: goalie.gamesPlayed,
              gamesStarted: goalie.gamesStarted,
              wins: goalie.wins,
              losses: goalie.losses,
              otLosses: goalie.otLosses,
              savePercentage: goalie.savePercentage
                ? Number(goalie.savePercentage)
                : null,
              goalsAgainstAvg: goalie.goalsAgainstAvg
                ? Number(goalie.goalsAgainstAvg)
                : null,
              shutouts: goalie.shutouts,
            }
          : null,
        projection,
        comparables,
        gmNote,
        generatedAt: new Date().toISOString(),
      };

      const title =
        input.title ?? `${player.fullName} — Player Evaluation`;

      const report = await prisma.savedReport.create({
        data: {
          userId,
          title,
          type: "PLAYER_EVAL",
          configuration: configuration as Prisma.InputJsonValue,
        },
      });

      trackEvent("REPORT_EXPORTED", userId, { playerId: input.playerId, reportId: report.id });

      return report;
    }),

  // ── Delete a report ──
  deleteReport: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = await getUserId(ctx.session);
      if (!userId) throw new Error("User not found");

      await prisma.savedReport.deleteMany({
        where: { id: input.id, userId },
      });

      return { success: true };
    }),

  // ── Update a report ──
  updateReport: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getUserId(ctx.session);
      if (!userId) throw new Error("User not found");

      const existing = await prisma.savedReport.findFirst({
        where: { id: input.id, userId },
      });
      if (!existing) throw new Error("Report not found");

      const data: Prisma.SavedReportUpdateInput = {};

      if (input.title !== undefined) {
        data.title = input.title;
      }

      if (input.notes !== undefined) {
        const config = (existing.configuration as Record<string, unknown>) ?? {};
        data.configuration = { ...config, notes: input.notes } as Prisma.InputJsonValue;
      }

      return prisma.savedReport.update({
        where: { id: input.id },
        data,
      });
    }),
});
