// ──────────────────────────────────────────────
// Roster Matrix — AI Router
// Natural language queries, team briefings,
// trade recommendations, and negotiation assistant
// ──────────────────────────────────────────────

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, analystProcedure, router } from "../trpc";
import { prisma } from "@/lib/prisma";
import {
  isAIEnabled,
  getAIClient,
  SYSTEM_PROMPT,
  generateText,
  generateJSON,
  MODEL,
  withRetry,
} from "../services/ai";
import { getLatestSeason } from "../services/value-batch";
import { trackEvent } from "../services/analytics";

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

const SALARY_CAP = 95_500_000;
const CURRENT_SEASON_END = 2026;

function requireAI() {
  if (!isAIEnabled()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "AI features require ANTHROPIC_API_KEY to be configured.",
    });
  }
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

function fmtAAV(aav: number): string {
  return `$${(aav / 1_000_000).toFixed(2)}M`;
}

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

// ── Router ──

export const aiRouter = router({
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. Natural Language Query
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  query: protectedProcedure
    .input(z.object({ question: z.string().min(3).max(500) }))
    .mutation(async ({ input }) => {
      requireAI();
      const season = await getLatestSeason();

      // Fetch a snapshot of available data for Claude to query against
      const allPlayers = await prisma.player.findMany({
        where: { isActive: true },
        select: {
          id: true,
          fullName: true,
          position: true,
          birthDate: true,
          currentTeam: {
            select: {
              id: true,
              name: true,
              abbreviation: true,
              division: true,
              conference: true,
            },
          },
          contracts: {
            orderBy: { startYear: "desc" as const },
            take: 1,
            select: {
              aav: true,
              endYear: true,
              totalYears: true,
              hasNTC: true,
              hasNMC: true,
              signingType: true,
            },
          },
          valueScores: {
            where: { season },
            orderBy: { calculatedAt: "desc" as const },
            take: 1,
            select: {
              overallScore: true,
              scoringComponent: true,
              efficiencyComponent: true,
              durabilityComponent: true,
            },
          },
          seasonStats: {
            where: { season },
            take: 1,
            select: {
              gamesPlayed: true,
              goals: true,
              assists: true,
              points: true,
            },
          },
        },
      });

      const playerSummaries = allPlayers
        .filter((p) => p.contracts.length > 0 && p.valueScores.length > 0)
        .map((p) => {
          const c = p.contracts[0];
          const v = p.valueScores[0];
          const s = p.seasonStats[0];
          return {
            id: p.id,
            name: p.fullName,
            pos: p.position,
            age: getAge(p.birthDate),
            team: p.currentTeam?.abbreviation ?? "FA",
            teamName: p.currentTeam?.name ?? "Free Agent",
            division: p.currentTeam?.division ?? "",
            conference: p.currentTeam?.conference ?? "",
            aav: Number(c.aav),
            yearsLeft: Math.max(0, c.endYear - CURRENT_SEASON_END),
            ntc: c.hasNTC,
            nmc: c.hasNMC,
            score: v.overallScore,
            gp: s?.gamesPlayed ?? 0,
            g: s?.goals ?? 0,
            a: s?.assists ?? 0,
            pts: s?.points ?? 0,
          };
        });

      // Ask Claude to interpret the query and find matching players
      const result = await generateJSON<{
        answer: string;
        players: Array<{
          id: string;
          name: string;
          reason: string;
        }>;
      }>(
        `You have access to a database of ${playerSummaries.length} NHL players. Here is the data:

${JSON.stringify(playerSummaries, null, 0)}

The user asks: "${input.question}"

Analyze the data and answer the question. Return JSON with:
- "answer": A clear, executive-level narrative response (2-4 paragraphs)
- "players": An array of the most relevant players (max 10) with their "id", "name", and a short "reason" explaining why they're included

If the question is about comparisons, trades, or recommendations, provide actionable insights. Always reference specific value scores, AAVs, and stats.`,
        { maxTokens: 3000 },
      );

      // Enrich the results with full data
      const enrichedPlayers = result.players
        .map((rp) => {
          const full = playerSummaries.find((p) => p.id === rp.id);
          if (!full) return null;
          return {
            playerId: full.id,
            playerName: full.name,
            position: full.pos,
            teamAbbreviation: full.team,
            age: full.age,
            aav: full.aav,
            valueScore: full.score,
            yearsRemaining: full.yearsLeft,
            goals: full.g,
            assists: full.a,
            points: full.pts,
            reason: rp.reason,
          };
        })
        .filter(Boolean);

      return {
        answer: result.answer,
        players: enrichedPlayers,
      };
    }),

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. Team Briefing
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  generateBriefing: analystProcedure
    .input(z.object({ teamId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      requireAI();
      trackEvent("AI_BRIEFING_GENERATED", undefined, { teamId: input.teamId });
      const season = await getLatestSeason();
      const teamId = input.teamId ?? (await getUserTeamId(ctx.session));

      if (!teamId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "No team specified. Set your team in Settings or provide a teamId.",
        });
      }

      const team = await prisma.team.findUniqueOrThrow({
        where: { id: teamId },
        select: { name: true, abbreviation: true },
      });

      // Get roster with contracts and value scores
      const roster = await prisma.player.findMany({
        where: { currentTeamId: teamId, isActive: true },
        select: {
          id: true,
          fullName: true,
          position: true,
          birthDate: true,
          contracts: {
            orderBy: { startYear: "desc" as const },
            take: 1,
            select: {
              aav: true,
              endYear: true,
              totalYears: true,
              hasNTC: true,
              hasNMC: true,
            },
          },
          valueScores: {
            where: { season },
            orderBy: { calculatedAt: "desc" as const },
            take: 1,
            select: { overallScore: true },
          },
          seasonStats: {
            where: { season },
            take: 1,
            select: { gamesPlayed: true, goals: true, assists: true, points: true },
          },
        },
      });

      const rosterData = roster
        .filter((p) => p.contracts.length > 0)
        .map((p) => {
          const c = p.contracts[0];
          const v = p.valueScores[0];
          const s = p.seasonStats[0];
          return {
            name: p.fullName,
            pos: p.position,
            age: getAge(p.birthDate),
            aav: fmtAAV(Number(c.aav)),
            aavRaw: Number(c.aav),
            yearsLeft: Math.max(0, c.endYear - CURRENT_SEASON_END),
            expiring: c.endYear <= CURRENT_SEASON_END,
            ntc: c.hasNTC,
            nmc: c.hasNMC,
            score: v?.overallScore ?? null,
            gp: s?.gamesPlayed ?? 0,
            pts: s?.points ?? 0,
          };
        });

      const totalCap = rosterData.reduce((s, p) => s + p.aavRaw, 0);
      const capSpace = SALARY_CAP - totalCap;
      const expiring = rosterData.filter((p) => p.expiring);
      const underperformers = rosterData.filter(
        (p) => p.score !== null && p.score < 40,
      );
      const outperformers = rosterData.filter(
        (p) => p.score !== null && p.score >= 70,
      );

      const briefing = await generateText(
        `Generate a weekly team briefing for the ${team.name} (${team.abbreviation}).

ROSTER DATA:
${JSON.stringify(rosterData, null, 2)}

CAP SITUATION:
- Total Cap Hit: ${fmtAAV(totalCap)}
- Cap Space: ${fmtAAV(capSpace)}
- Salary Cap Ceiling: ${fmtAAV(SALARY_CAP)}
- Contracts Expiring This Year: ${expiring.length}

KEY METRICS:
- Outperformers (score 70+): ${outperformers.length}
- Underperformers (score <40): ${underperformers.length}
- Roster Size: ${rosterData.length}

Write a professional team briefing with these sections:
1. **Executive Summary** — 2-3 sentence overview of team's contract health
2. **Roster Value Report** — Highlight top performers and concerns. Reference specific value scores and AAVs.
3. **Upcoming Contract Decisions** — Players expiring or in final year. Recommend retain/extend/let walk.
4. **Trade Opportunities** — Based on underperformers and cap space, suggest 2-3 actionable moves.
5. **Cap Outlook** — Project cap situation for next 2 years.
6. **Recommended Actions** — Prioritized list of 3-5 specific action items.

Write in concise, executive language. No fluff. Use specific numbers throughout.`,
        { maxTokens: 3000, temperature: 0.4 },
      );

      return {
        teamName: team.name,
        teamAbbreviation: team.abbreviation,
        generatedAt: new Date().toISOString(),
        briefing,
        summary: {
          rosterSize: rosterData.length,
          totalCapHit: totalCap,
          capSpace,
          expiringContracts: expiring.length,
          outperformers: outperformers.length,
          underperformers: underperformers.length,
        },
      };
    }),

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. AI Trade Recommendations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  getTradeRecommendations: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ input }) => {
      requireAI();
      const season = await getLatestSeason();

      const team = await prisma.team.findUniqueOrThrow({
        where: { id: input.teamId },
        select: { name: true, abbreviation: true },
      });

      // Roster with scores
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

      // Find trade targets from other teams
      const targets = await prisma.player.findMany({
        where: {
          isActive: true,
          currentTeamId: { not: input.teamId },
          valueScores: {
            some: { season, overallScore: { gte: 55 } },
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
            select: { overallScore: true, positionGroup: true },
          },
          seasonStats: {
            where: { season },
            take: 1,
            select: { gamesPlayed: true, goals: true, assists: true, points: true },
          },
        },
        take: 100,
      });

      const rosterData = roster
        .filter((p) => p.contracts.length > 0)
        .map((p) => {
          const c = p.contracts[0];
          return {
            name: p.fullName,
            pos: p.position,
            posGroup: p.valueScores[0]?.positionGroup ?? null,
            age: getAge(p.birthDate),
            aav: Number(c.aav),
            yearsLeft: Math.max(0, c.endYear - CURRENT_SEASON_END),
            score: p.valueScores[0]?.overallScore ?? null,
            ntc: c.hasNTC,
            nmc: c.hasNMC,
          };
        });

      const targetData = targets
        .filter((p) => p.contracts.length > 0)
        .map((p) => {
          const c = p.contracts[0];
          const s = p.seasonStats[0];
          return {
            id: p.id,
            name: p.fullName,
            pos: p.position,
            posGroup: p.valueScores[0]?.positionGroup ?? null,
            age: getAge(p.birthDate),
            team: p.currentTeam?.abbreviation ?? "FA",
            teamName: p.currentTeam?.name ?? "",
            aav: Number(c.aav),
            yearsLeft: Math.max(0, c.endYear - CURRENT_SEASON_END),
            score: p.valueScores[0]?.overallScore ?? 0,
            ntc: c.hasNTC,
            nmc: c.hasNMC,
            pts: s?.points ?? 0,
            gp: s?.gamesPlayed ?? 0,
          };
        });

      const totalCap = rosterData.reduce((s, p) => s + p.aav, 0);
      const capSpace = SALARY_CAP - totalCap;

      const recommendations = await generateJSON<{
        analysis: string;
        weaknesses: string[];
        recommendations: Array<{
          targetId: string;
          targetName: string;
          headline: string;
          rationale: string;
          capFit: string;
          riskLevel: "low" | "medium" | "high";
          priority: number;
        }>;
      }>(
        `Analyze the ${team.name} roster and recommend trade targets.

ROSTER (${team.abbreviation}):
${JSON.stringify(rosterData, null, 0)}

Cap Space: ${fmtAAV(capSpace)} | Cap Ceiling: ${fmtAAV(SALARY_CAP)}

AVAILABLE TRADE TARGETS (other teams):
${JSON.stringify(targetData, null, 0)}

Return JSON with:
- "analysis": 2-3 sentence assessment of the team's roster strengths/weaknesses
- "weaknesses": Array of 2-4 position group weaknesses (e.g., "Top-4 defense depth", "1C production")
- "recommendations": Array of 5-8 trade targets ranked by priority (1=highest), each with:
  - "targetId": the player's id from the data
  - "targetName": player name
  - "headline": one-line trade pitch (e.g., "Add elite 1C production at fair value")
  - "rationale": 2-3 sentences on why this player fits, referencing value score, cap fit, and team need
  - "capFit": how the AAV fits under the cap
  - "riskLevel": "low", "medium", or "high" based on NTC/NMC, age, and term
  - "priority": 1 through 8

Only recommend players who genuinely address roster weaknesses. Factor in age alignment, cap fit, and trade protection.`,
        { maxTokens: 3000 },
      );

      // Enrich recommendations with full data
      const enriched = recommendations.recommendations.map((rec) => {
        const target = targetData.find((t) => t.id === rec.targetId);
        return {
          ...rec,
          position: target?.pos ?? "",
          teamAbbreviation: target?.team ?? "",
          teamName: target?.teamName ?? "",
          age: target?.age ?? 0,
          aav: target?.aav ?? 0,
          valueScore: target?.score ?? 0,
          yearsRemaining: target?.yearsLeft ?? 0,
          hasNTC: target?.ntc ?? false,
          hasNMC: target?.nmc ?? false,
          points: target?.pts ?? 0,
          gamesPlayed: target?.gp ?? 0,
        };
      });

      return {
        teamName: team.name,
        teamAbbreviation: team.abbreviation,
        analysis: recommendations.analysis,
        weaknesses: recommendations.weaknesses,
        recommendations: enriched,
        capSpace,
      };
    }),

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. Contract Negotiation Assistant
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  getNegotiationBrief: protectedProcedure
    .input(z.object({ playerId: z.string() }))
    .mutation(async ({ input }) => {
      requireAI();
      trackEvent("AI_NEGOTIATION_VIEWED", undefined, { playerId: input.playerId });
      const season = await getLatestSeason();

      const player = await prisma.player.findUniqueOrThrow({
        where: { id: input.playerId },
        include: {
          currentTeam: { select: { name: true, abbreviation: true } },
          contracts: { orderBy: { startYear: "desc" as const }, take: 1 },
          seasonStats: {
            orderBy: { season: "desc" },
            take: 3,
            select: {
              season: true,
              gamesPlayed: true,
              goals: true,
              assists: true,
              points: true,
              plusMinus: true,
            },
          },
          goalieStats: {
            orderBy: { season: "desc" },
            take: 3,
            select: {
              season: true,
              gamesPlayed: true,
              gamesStarted: true,
              wins: true,
              savePercentage: true,
              goalsAgainstAvg: true,
            },
          },
          valueScores: {
            where: { season },
            orderBy: { calculatedAt: "desc" as const },
            take: 1,
            select: {
              overallScore: true,
              scoringComponent: true,
              efficiencyComponent: true,
              durabilityComponent: true,
              fiveOnFiveComponent: true,
              specialTeamsComponent: true,
            },
          },
        },
      });

      const contract = player.contracts[0];
      const age = getAge(player.birthDate);
      const score = player.valueScores[0];
      const isGoalie = player.position === "G";

      // Find comparable players for market context
      const comparables = await prisma.player.findMany({
        where: {
          isActive: true,
          position: player.position,
          id: { not: player.id },
          valueScores: { some: { season } },
          contracts: {
            some: {
              aav: contract
                ? {
                    gte: Number(contract.aav) * 0.7,
                    lte: Number(contract.aav) * 1.3,
                  }
                : undefined,
            },
          },
        },
        select: {
          fullName: true,
          position: true,
          birthDate: true,
          contracts: {
            orderBy: { startYear: "desc" as const },
            take: 1,
            select: { aav: true, totalYears: true, signingType: true },
          },
          valueScores: {
            where: { season },
            orderBy: { calculatedAt: "desc" as const },
            take: 1,
            select: { overallScore: true },
          },
          seasonStats: {
            where: { season },
            take: 1,
            select: { gamesPlayed: true, goals: true, assists: true, points: true },
          },
        },
        take: 10,
      });

      const compData = comparables
        .filter((c) => c.contracts.length > 0 && c.valueScores.length > 0)
        .map((c) => ({
          name: c.fullName,
          age: getAge(c.birthDate),
          aav: fmtAAV(Number(c.contracts[0].aav)),
          aavRaw: Number(c.contracts[0].aav),
          term: c.contracts[0].totalYears,
          score: c.valueScores[0].overallScore,
          pts: c.seasonStats[0]?.points ?? 0,
        }));

      const playerProfile = {
        name: player.fullName,
        position: player.position,
        age,
        team: player.currentTeam?.name ?? "Free Agent",
        teamAbbrev: player.currentTeam?.abbreviation ?? "FA",
        currentAAV: contract ? fmtAAV(Number(contract.aav)) : "N/A",
        currentAAVRaw: contract ? Number(contract.aav) : 0,
        yearsRemaining: contract
          ? Math.max(0, contract.endYear - CURRENT_SEASON_END)
          : 0,
        valueScore: score?.overallScore ?? null,
        components: score
          ? {
              scoring: Number(score.scoringComponent ?? 0),
              efficiency: Number(score.efficiencyComponent ?? 0),
              durability: Number(score.durabilityComponent ?? 0),
              fiveOnFive: Number(score.fiveOnFiveComponent ?? 0),
              specialTeams: Number(score.specialTeamsComponent ?? 0),
            }
          : null,
        recentSeasons: isGoalie
          ? player.goalieStats.map((g) => ({
              season: g.season,
              gp: g.gamesPlayed,
              gs: g.gamesStarted,
              w: g.wins,
              svPct: Number(g.savePercentage),
              gaa: Number(g.goalsAgainstAvg),
            }))
          : player.seasonStats.map((s) => ({
              season: s.season,
              gp: s.gamesPlayed,
              g: s.goals,
              a: s.assists,
              pts: s.points,
              pm: s.plusMinus,
            })),
      };

      const briefing = await generateText(
        `Generate a contract negotiation briefing for ${player.fullName}.

PLAYER PROFILE:
${JSON.stringify(playerProfile, null, 2)}

COMPARABLE CONTRACTS:
${JSON.stringify(compData, null, 2)}

Generate a comprehensive negotiation briefing with these exact sections:

## Fair Market Value
Based on comparables and production, provide a specific AAV range (low, mid, high) and recommended term.

## Arguments FOR a Higher AAV (Agent's Perspective)
List 4-5 specific, data-backed arguments the player's agent would use to justify a higher contract. Reference specific stats, trends, comparables.

## Arguments FOR a Lower AAV (GM's Leverage Points)
List 4-5 specific, data-backed arguments the GM would use to negotiate a lower number. Reference age curve, injury risk, comparable contracts, market factors.

## Comparable Contract Analysis
Analyze 3-4 of the most relevant comparables. For each, explain why the comparison is apt and what it implies for this negotiation.

## Recommended Negotiation Strategy
Provide a specific recommended approach for the GM, including:
- Opening offer
- Walk-away number
- Key leverage points
- Timing considerations
- Suggested term and structure (front-loaded, even, etc.)

Be specific with dollar amounts throughout. Reference the salary cap ($95.5M) context. Write in executive language.`,
        { maxTokens: 3500, temperature: 0.4 },
      );

      return {
        playerName: player.fullName,
        position: player.position,
        teamName: player.currentTeam?.name ?? null,
        age,
        currentAAV: contract ? Number(contract.aav) : null,
        valueScore: score?.overallScore ?? null,
        briefing,
        comparables: compData,
        generatedAt: new Date().toISOString(),
      };
    }),

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. AI Scout Chat
  // Multi-turn conversational player search
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  scoutChat: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1).max(1000),
        history: z.array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string(),
          }),
        ).max(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAI();
      const userId = await getUserId(ctx.session).catch(() => null);
      trackEvent("AI_SCOUT_QUERY", userId, { query: input.message });
      const season = await getLatestSeason();
      const userTeamId = await getUserTeamId(ctx.session);

      // ── Pre-filter: parse query for keywords to build a Prisma WHERE ──
      const msg = input.message.toLowerCase();

      const positionMap: Record<string, string[]> = {
        center: ["C"], centres: ["C"], centers: ["C"], "1c": ["C"], "2c": ["C"], "3c": ["C"],
        wing: ["LW", "RW"], winger: ["LW", "RW"], wingers: ["LW", "RW"],
        "left wing": ["LW"], lw: ["LW"],
        "right wing": ["RW"], rw: ["RW"],
        forward: ["C", "LW", "RW"], forwards: ["C", "LW", "RW"],
        defense: ["D"], defenseman: ["D"], defensemen: ["D"], "d-man": ["D"], dman: ["D"],
        goalie: ["G"], goaltender: ["G"], goalies: ["G"], goaltenders: ["G"], netminder: ["G"],
      };
      const matchedPositions: string[] = [];
      for (const [keyword, positions] of Object.entries(positionMap)) {
        if (msg.includes(keyword)) {
          for (const p of positions) {
            if (!matchedPositions.includes(p)) matchedPositions.push(p);
          }
        }
      }

      // AAV range parsing (e.g., "under $5M", "below 3 million", "$4-8M")
      let aavMax: number | undefined;
      let aavMin: number | undefined;
      const underMatch = msg.match(/(?:under|below|less than|max|cheaper than)\s*\$?([\d.]+)\s*(?:m|mil|million)?/i);
      if (underMatch) aavMax = parseFloat(underMatch[1]) * 1_000_000;
      const overMatch = msg.match(/(?:over|above|more than|at least|min)\s*\$?([\d.]+)\s*(?:m|mil|million)?/i);
      if (overMatch) aavMin = parseFloat(overMatch[1]) * 1_000_000;
      const rangeMatch = msg.match(/\$?([\d.]+)\s*(?:m|mil|million)?\s*[-–to]+\s*\$?([\d.]+)\s*(?:m|mil|million)?/i);
      if (rangeMatch) {
        aavMin = parseFloat(rangeMatch[1]) * 1_000_000;
        aavMax = parseFloat(rangeMatch[2]) * 1_000_000;
      }

      // Age range parsing
      let ageMax: number | undefined;
      let ageMin: number | undefined;
      const youngMatch = msg.match(/(?:under|below|younger than)\s*(\d{2})\s*(?:years|yrs)?/i);
      if (youngMatch) ageMax = parseInt(youngMatch[1]);
      const oldMatch = msg.match(/(?:over|above|older than)\s*(\d{2})\s*(?:years|yrs)?/i);
      if (oldMatch) ageMin = parseInt(oldMatch[1]);
      if (msg.includes("young") || msg.includes("prospect") || msg.includes("elc")) ageMax = ageMax ?? 25;
      if (msg.includes("veteran") || msg.includes("experienced")) ageMin = ageMin ?? 30;

      // Team abbreviation parsing
      const teamAbbrevs = ["ANA","BOS","BUF","CAR","CBJ","CGY","CHI","COL","DAL","DET","EDM","FLA","LAK","MIN","MTL","NJD","NSH","NYI","NYR","OTT","PHI","PIT","SEA","SJS","STL","TBL","TOR","UTA","VAN","VGK","WPG","WSH"];
      const matchedTeams: string[] = [];
      for (const abbr of teamAbbrevs) {
        if (new RegExp(`\\b${abbr}\\b`, "i").test(msg)) matchedTeams.push(abbr);
      }

      // Value filter keywords
      let minScore: number | undefined;
      if (msg.includes("overperform") || msg.includes("outperform") || msg.includes("great value") || msg.includes("bargain")) minScore = 70;
      if (msg.includes("underperform") || msg.includes("overpaid") || msg.includes("bad value") || msg.includes("bad contract")) minScore = undefined; // handled below
      let maxScore: number | undefined;
      if (msg.includes("underperform") || msg.includes("overpaid") || msg.includes("bad value") || msg.includes("bad contract")) maxScore = 45;

      // Expiring contract filter
      const wantExpiring = msg.includes("expir") || msg.includes("ufa") || msg.includes("rental") || msg.includes("deadline");

      // Build Prisma where clause
      const playerWhere: Record<string, unknown> = { isActive: true };
      if (matchedPositions.length > 0) {
        playerWhere.position = { in: matchedPositions };
      }
      if (matchedTeams.length > 0) {
        playerWhere.currentTeam = { abbreviation: { in: matchedTeams } };
      }

      const contractWhere: Record<string, unknown> = { status: "ACTIVE" };
      if (aavMin !== undefined || aavMax !== undefined) {
        const aavFilter: Record<string, unknown> = {};
        if (aavMin !== undefined) aavFilter.gte = aavMin;
        if (aavMax !== undefined) aavFilter.lte = aavMax;
        contractWhere.aav = aavFilter;
      }
      if (wantExpiring) {
        contractWhere.endYear = { lte: CURRENT_SEASON_END + 1 };
      }

      const valueWhere: Record<string, unknown> = { season };
      if (minScore !== undefined || maxScore !== undefined) {
        const scoreFilter: Record<string, unknown> = {};
        if (minScore !== undefined) scoreFilter.gte = minScore;
        if (maxScore !== undefined) scoreFilter.lte = maxScore;
        valueWhere.overallScore = scoreFilter;
      }

      // Fetch filtered players
      const allPlayers = await prisma.player.findMany({
        where: {
          ...playerWhere,
          contracts: { some: contractWhere },
          ...(minScore !== undefined || maxScore !== undefined
            ? { valueScores: { some: valueWhere } }
            : {}),
        },
        select: {
          id: true,
          fullName: true,
          position: true,
          birthDate: true,
          shootsCatches: true,
          currentTeam: {
            select: {
              id: true,
              name: true,
              abbreviation: true,
              division: true,
              conference: true,
            },
          },
          contracts: {
            where: { status: "ACTIVE" },
            orderBy: { startYear: "desc" as const },
            take: 1,
            select: {
              aav: true,
              endYear: true,
              startYear: true,
              totalYears: true,
              hasNTC: true,
              hasNMC: true,
              signingType: true,
            },
          },
          valueScores: {
            where: { season },
            orderBy: { calculatedAt: "desc" as const },
            take: 1,
            select: {
              overallScore: true,
              grade: true,
              estimatedWAR: true,
              costPerPoint: true,
            },
          },
          seasonStats: {
            where: { season },
            take: 1,
            select: {
              gamesPlayed: true,
              goals: true,
              assists: true,
              points: true,
              plusMinus: true,
              toiPerGame: true,
              powerPlayGoals: true,
              powerPlayPoints: true,
              hits: true,
              blocks: true,
            },
          },
          goalieStats: {
            where: { season },
            take: 1,
            select: {
              gamesPlayed: true,
              gamesStarted: true,
              wins: true,
              losses: true,
              savePercentage: true,
              goalsAgainstAvg: true,
              shutouts: true,
            },
          },
        },
      });

      // Build compact player data, apply age filters in-memory, limit to 100
      let playerData = allPlayers
        .filter((p) => p.contracts.length > 0)
        .map((p) => {
          const c = p.contracts[0];
          const v = p.valueScores[0];
          const s = p.seasonStats[0];
          const g = p.goalieStats[0];
          const age = getAge(p.birthDate);
          const yearsLeft = Math.max(0, c.endYear - CURRENT_SEASON_END);

          const base: Record<string, unknown> = {
            id: p.id,
            name: p.fullName,
            pos: p.position,
            hand: p.shootsCatches ?? "L",
            age,
            team: p.currentTeam?.abbreviation ?? "FA",
            teamName: p.currentTeam?.name ?? "Free Agent",
            div: p.currentTeam?.division ?? "",
            aav: Number(c.aav),
            yearsLeft,
            ntc: c.hasNTC,
            nmc: c.hasNMC,
            score: v?.overallScore ?? null,
            grade: v?.grade ?? null,
          };

          if (s) {
            Object.assign(base, {
              gp: s.gamesPlayed,
              g: s.goals,
              a: s.assists,
              pts: s.points,
              pm: s.plusMinus,
              toi: Number(s.toiPerGame ?? 0),
              ppg: s.powerPlayGoals,
              ppp: s.powerPlayPoints,
              hits: s.hits,
              blk: s.blocks,
            });
          }

          if (g) {
            Object.assign(base, {
              gp: g.gamesPlayed,
              gs: g.gamesStarted,
              w: g.wins,
              l: g.losses,
              svPct: Number(g.savePercentage ?? 0),
              gaa: Number(g.goalsAgainstAvg ?? 0),
              so: g.shutouts,
            });
          }

          if (v) {
            base.war = Number(v.estimatedWAR ?? 0);
          }

          return base;
        });

      // Apply age filters in-memory
      if (ageMin !== undefined) playerData = playerData.filter((p) => (p.age as number) >= ageMin!);
      if (ageMax !== undefined) playerData = playerData.filter((p) => (p.age as number) <= ageMax!);

      // Sort by value score descending and cap at 100 players
      playerData.sort((a, b) => ((b.score as number) ?? 0) - ((a.score as number) ?? 0));
      playerData = playerData.slice(0, 100);

      // Get user's team cap context if available
      let teamContext = "";
      if (userTeamId) {
        const team = await prisma.team.findUnique({
          where: { id: userTeamId },
          select: { name: true, abbreviation: true },
        });
        if (team) {
          const teamContracts = await prisma.contract.findMany({
            where: {
              player: { currentTeamId: userTeamId, isActive: true },
              status: "ACTIVE",
              startYear: { lte: CURRENT_SEASON_END - 1 },
              endYear: { gte: CURRENT_SEASON_END },
            },
            select: { aav: true, player: { select: { fullName: true } } },
          });
          const seen = new Set<string>();
          const teamCap = teamContracts.reduce((sum, c) => {
            if (seen.has(c.player.fullName)) return sum;
            seen.add(c.player.fullName);
            return sum + Number(c.aav);
          }, 0);
          const capSpace = SALARY_CAP - teamCap;
          teamContext = `\nThe user is affiliated with the ${team.name} (${team.abbreviation}). Current roster cap usage: ${fmtAAV(teamCap)}, available cap space: ${fmtAAV(capSpace)}. Factor this into trade feasibility and cap fit analysis when relevant.`;
        }
      }

      const scoutSystemPrompt = `${SYSTEM_PROMPT}

You are the AI Scout — a conversational player search and recommendation assistant. Your job is to help NHL executives find players that match specific criteria.
${teamContext}

RESPONSE FORMAT:
You MUST respond with raw JSON only — NO markdown code fences, NO backticks, NO \`\`\`json wrapper. Just the raw JSON object directly.
{
  "message": "Your response as clean markdown text. Use **bold** for player names, ## for section headings, and - for bullet lists. Do NOT include any JSON, code blocks, or raw data in this field — it will be rendered as formatted text. Reference specific stats, value scores, and contract details inline.",
  "players": [
    {
      "id": "player_id_from_data",
      "name": "Player Full Name",
      "fit": "Brief explanation of why this player fits the request"
    }
  ]
}

CRITICAL: The "message" field is displayed as rendered markdown. Write it as a natural, readable executive briefing — NOT as JSON or data dumps. The "players" array provides structured data separately; do not repeat raw player data in the message.

The "players" array should contain 3-5 best-fit recommendations, ranked by fit. If the user's question is conversational (not a player search), return an empty players array.

GUIDELINES:
- Search the database provided below — these are the most relevant matches pre-filtered from ${allPlayers.length} total active players
- Rank by actual fit to the criteria, not just fame
- Always reference specific AAV, value score, age, years left, and key stats in the message text
- If a player has NTC/NMC, mention it as a potential trade complication
- If a contract expires within 1 year, flag the projected next contract risk
- Consider handedness when the user specifies it
- Compare value scores: 75+ = great value, 60-74 = good, 45-59 = fair, <45 = overpaid
- Use concise executive language`;

      // Build conversation messages
      const messages: Array<{ role: "user" | "assistant"; content: string }> =
        [];

      // Add history
      for (const msg of input.history) {
        messages.push({ role: msg.role, content: msg.content });
      }

      // Add current message with player database context
      messages.push({
        role: "user",
        content: `DATABASE (${playerData.length} players matching criteria):
${JSON.stringify(playerData, null, 0)}

USER REQUEST: ${input.message}`,
      });

      const ai = getAIClient();
      const response = await withRetry(() =>
        ai.messages.create({
          model: MODEL,
          max_tokens: 4096,
          temperature: 0.3,
          system: scoutSystemPrompt,
          messages,
        }),
      );

      const block = response.content[0];
      if (block.type !== "text") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unexpected AI response format",
        });
      }

      let parsed: { message: string; players: Array<{ id: string; name: string; fit: string }> };
      try {
        // Strip markdown code fences if Claude wrapped the JSON
        let jsonText = block.text.trim();
        if (jsonText.startsWith("```")) {
          jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
        }
        parsed = JSON.parse(jsonText);
      } catch {
        // If still not valid JSON, try to extract JSON from the text
        const jsonMatch = block.text.match(/\{[\s\S]*"message"\s*:[\s\S]*"players"\s*:[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {
            parsed = { message: block.text, players: [] };
          }
        } else {
          parsed = { message: block.text, players: [] };
        }
      }

      // Enrich player references with full data
      const enrichedPlayers = parsed.players
        .map((rp) => {
          const full = playerData.find((p) => p.id === rp.id);
          if (!full) return null;
          const yearsLeft = full.yearsLeft as number;

          return {
            id: full.id as string,
            name: full.name as string,
            position: full.pos as string,
            team: full.team as string,
            teamName: full.teamName as string,
            age: full.age as number,
            aav: full.aav as number,
            valueScore: (full.score as number) ?? null,
            grade: (full.grade as string) ?? null,
            yearsLeft,
            expiringContract: yearsLeft <= 1,
            hasNTC: (full.ntc as boolean) ?? false,
            hasNMC: (full.nmc as boolean) ?? false,
            gamesPlayed: (full.gp as number) ?? 0,
            goals: (full.g as number) ?? null,
            assists: (full.a as number) ?? null,
            points: (full.pts as number) ?? null,
            svPct: (full.svPct as number) ?? null,
            gaa: (full.gaa as number) ?? null,
            fit: rp.fit,
          };
        })
        .filter(Boolean);

      return {
        message: parsed.message,
        players: enrichedPlayers,
        // Return the raw assistant content for conversation history
        rawResponse: block.text,
      };
    }),
});
