// ──────────────────────────────────────────────
// Roster Matrix — Watchlist Router
// Backend procedures for managing player watch lists
// ──────────────────────────────────────────────

import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { prisma } from "@/lib/prisma";
import { getLatestSeason } from "@/server/services/value-batch";

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

export const watchlistRouter = router({
  // ── Get all user's watch lists with player count ──
  getLists: protectedProcedure.query(async ({ ctx }) => {
    const userId = await getUserId(ctx.session);
    if (!userId) return [];

    return prisma.watchList.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { players: true } },
      },
    });
  }),

  // ── Get a single watch list with full player details ──
  getList: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = await getUserId(ctx.session);
      if (!userId) return null;

      const season = await getLatestSeason();

      const list = await prisma.watchList.findFirst({
        where: { id: input.id, userId },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          players: {
            orderBy: { addedAt: "desc" },
            select: {
              id: true,
              playerId: true,
              scoreWhenAdded: true,
              addedAt: true,
              player: {
                select: {
                  id: true,
                  fullName: true,
                  position: true,
                  birthDate: true,
                  currentTeam: {
                    select: { abbreviation: true },
                  },
                  contracts: {
                    orderBy: { startYear: "desc" as const },
                    take: 1,
                    select: { aav: true },
                  },
                  valueScores: {
                    where: { season },
                    orderBy: { calculatedAt: "desc" as const },
                    take: 1,
                    select: { overallScore: true, grade: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!list) return null;

      return {
        id: list.id,
        name: list.name,
        description: list.description,
        createdAt: list.createdAt,
        players: list.players.map((entry) => {
          const p = entry.player;
          const currentScore = p.valueScores[0]?.overallScore ?? null;
          return {
            entryId: entry.id,
            playerId: entry.playerId,
            name: p.fullName,
            position: p.position,
            team: p.currentTeam?.abbreviation ?? null,
            age: getAge(p.birthDate),
            aav: p.contracts[0] ? Number(p.contracts[0].aav) : 0,
            currentScore,
            scoreWhenAdded: entry.scoreWhenAdded,
            grade: p.valueScores[0]?.grade ?? null,
            addedAt: entry.addedAt,
          };
        }),
      };
    }),

  // ── Create a new watch list ──
  createList: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getUserId(ctx.session);
      if (!userId) throw new Error("User not found");

      const list = await prisma.watchList.create({
        data: {
          userId,
          name: input.name,
          description: input.description,
        },
      });

      return { id: list.id };
    }),

  // ── Delete a watch list ──
  deleteList: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = await getUserId(ctx.session);
      if (!userId) throw new Error("User not found");

      await prisma.watchList.delete({
        where: { id: input.id, userId },
      });

      return { success: true };
    }),

  // ── Add a player to a watch list ──
  addPlayer: protectedProcedure
    .input(
      z.object({
        watchListId: z.string(),
        playerId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getUserId(ctx.session);
      if (!userId) throw new Error("User not found");

      // Verify the watch list belongs to the user
      const list = await prisma.watchList.findFirst({
        where: { id: input.watchListId, userId },
        select: { id: true },
      });
      if (!list) throw new Error("Watch list not found");

      // Get the player's current value score
      const season = await getLatestSeason();
      const valueScore = await prisma.playerValueScore.findFirst({
        where: { playerId: input.playerId, season },
        orderBy: { calculatedAt: "desc" },
        select: { overallScore: true },
      });

      await prisma.watchListPlayer.create({
        data: {
          watchListId: input.watchListId,
          playerId: input.playerId,
          scoreWhenAdded: valueScore?.overallScore ?? null,
        },
      });

      return { success: true };
    }),

  // ── Remove a player from a watch list ──
  removePlayer: protectedProcedure
    .input(
      z.object({
        watchListId: z.string(),
        playerId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await getUserId(ctx.session);
      if (!userId) throw new Error("User not found");

      // Verify ownership
      const list = await prisma.watchList.findFirst({
        where: { id: input.watchListId, userId },
        select: { id: true },
      });
      if (!list) throw new Error("Watch list not found");

      await prisma.watchListPlayer.delete({
        where: {
          watchListId_playerId: {
            watchListId: input.watchListId,
            playerId: input.playerId,
          },
        },
      });

      return { success: true };
    }),

  // ── Get which of the user's watch lists contain a given player ──
  getPlayerWatchLists: protectedProcedure
    .input(z.object({ playerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = await getUserId(ctx.session);
      if (!userId) return [];

      const lists = await prisma.watchList.findMany({
        where: {
          userId,
          players: { some: { playerId: input.playerId } },
        },
        select: {
          id: true,
          name: true,
        },
      });

      return lists;
    }),
});
