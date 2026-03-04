// ──────────────────────────────────────────────
// Roster Matrix — Notification Router
// ──────────────────────────────────────────────

import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import { prisma } from "@/lib/prisma";
import {
  broadcastNotification,
  notifyTradeAlert,
} from "@/server/services/notifications";

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

export const notificationRouter = router({
  // Get recent notifications (paginated)
  getNotifications: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).optional(),
        cursor: z.string().optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = await getUserId(ctx.session);
      if (!userId) return { items: [], nextCursor: null };

      const limit = input?.limit ?? 20;

      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(input?.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          link: true,
          isRead: true,
          createdAt: true,
        },
      });

      let nextCursor: string | null = null;
      if (notifications.length > limit) {
        const next = notifications.pop()!;
        nextCursor = next.id;
      }

      return { items: notifications, nextCursor };
    }),

  // Get unread count
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const userId = await getUserId(ctx.session);
    if (!userId) return 0;

    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }),

  // Mark a single notification as read
  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = await getUserId(ctx.session);
      if (!userId) throw new Error("User not found");

      await prisma.notification.updateMany({
        where: { id: input.id, userId },
        data: { isRead: true },
      });

      return { success: true };
    }),

  // Mark all notifications as read
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = await getUserId(ctx.session);
    if (!userId) throw new Error("User not found");

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { success: true };
  }),

  // ── Admin: Broadcast notification ──
  broadcast: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        message: z.string().min(1).max(1000),
        link: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const count = await broadcastNotification(
        input.title,
        input.message,
        "SYSTEM",
        input.link,
      );
      return { delivered: count };
    }),

  // ── Admin: Create trade alert for a player ──
  createTradeAlert: adminProcedure
    .input(
      z.object({
        playerId: z.string(),
        message: z.string().min(1).max(1000),
      }),
    )
    .mutation(async ({ input }) => {
      const player = await prisma.player.findUniqueOrThrow({
        where: { id: input.playerId },
        select: { fullName: true },
      });

      const count = await notifyTradeAlert(
        input.playerId,
        player.fullName,
        input.message,
      );
      return { delivered: count, playerName: player.fullName };
    }),

  // ── Admin: Get delivery stats ──
  getStats: adminProcedure.query(async () => {
    const [total, unread, byType] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { isRead: false } }),
      prisma.notification.groupBy({
        by: ["type"],
        _count: true,
        orderBy: { _count: { type: "desc" } },
      }),
    ]);

    return {
      total,
      unread,
      byType: byType.map((g) => ({ type: g.type, count: g._count })),
    };
  }),
});
