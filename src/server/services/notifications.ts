// ──────────────────────────────────────────────
// Roster Matrix — Notification Service
// Creates notifications and pushes via SSE
// ──────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { eventBus } from "@/lib/sse";
import type { NotificationType } from "@prisma/client";

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  playerId?: string;
}

export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      playerId: input.playerId ?? null,
    },
  });

  // Push to connected SSE clients
  eventBus.emit(input.userId, {
    type: "NOTIFICATION",
    data: {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      isRead: false,
      createdAt: notification.createdAt.toISOString(),
    },
  });

  return notification;
}

export async function createBulkNotifications(
  inputs: CreateNotificationInput[],
) {
  if (inputs.length === 0) return;

  await prisma.notification.createMany({
    data: inputs.map((input) => ({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      playerId: input.playerId ?? null,
    })),
  });

  // Push SSE events for each user
  for (const input of inputs) {
    eventBus.emit(input.userId, {
      type: "NOTIFICATION",
      data: {
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    });
  }
}

/**
 * After value batch recalculation, notify users who have
 * watched players with significant score changes (≥5 points).
 */
export async function notifyScoreChanges(season: string) {
  // Get all watch list entries with their associated users
  const watchEntries = await prisma.watchListPlayer.findMany({
    where: { scoreWhenAdded: { not: null } },
    select: {
      playerId: true,
      scoreWhenAdded: true,
      watchList: {
        select: {
          userId: true,
        },
      },
      player: {
        select: {
          fullName: true,
          id: true,
        },
      },
    },
  });

  // Get latest scores for those players
  const playerIds = Array.from(new Set(watchEntries.map((e) => e.playerId)));
  const latestScores = await prisma.playerValueScore.findMany({
    where: { playerId: { in: playerIds }, season },
    orderBy: { calculatedAt: "desc" },
    distinct: ["playerId"],
    select: { playerId: true, overallScore: true },
  });

  const scoreMap = new Map(latestScores.map((s) => [s.playerId, s.overallScore]));

  const notifications: CreateNotificationInput[] = [];

  for (const entry of watchEntries) {
    const currentScore = scoreMap.get(entry.playerId);
    if (currentScore == null || entry.scoreWhenAdded == null) continue;

    const delta = currentScore - entry.scoreWhenAdded;
    if (Math.abs(delta) < 5) continue;

    const direction = delta > 0 ? "increased" : "decreased";
    notifications.push({
      userId: entry.watchList.userId,
      type: "SCORE_CHANGE",
      title: `${entry.player.fullName} value ${direction}`,
      message: `${entry.player.fullName}'s value score ${direction} by ${Math.abs(delta)} points (now ${currentScore}).`,
      link: `/players/${entry.player.id}`,
      playerId: entry.player.id,
    });
  }

  // Deduplicate (same user + same player = one notification)
  const seen = new Set<string>();
  const unique = notifications.filter((n) => {
    const key = `${n.userId}:${n.playerId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length > 0) {
    await createBulkNotifications(unique);
  }

  return unique.length;
}

/**
 * Create CONTRACT_UPDATE notifications for all users when new contracts are imported.
 */
export async function notifyContractUpdate(
  playerName: string,
  playerId: string,
  aav: number,
  term: number,
) {
  const allUsers = await prisma.user.findMany({
    select: { id: true },
  });

  const aavM = (aav / 1_000_000).toFixed(1);
  const inputs: CreateNotificationInput[] = allUsers.map((u) => ({
    userId: u.id,
    type: "CONTRACT_UPDATE" as NotificationType,
    title: `${playerName} signed`,
    message: `${playerName} signed a ${term}-year, $${aavM}M AAV contract.`,
    link: `/players/${playerId}`,
    playerId,
  }));

  await createBulkNotifications(inputs);
  return inputs.length;
}

/**
 * Create TRADE_ALERT notifications for users who have the player on a watch list.
 */
export async function notifyTradeAlert(
  playerId: string,
  playerName: string,
  message: string,
) {
  const watchingUsers = await prisma.watchListPlayer.findMany({
    where: { playerId },
    select: {
      watchList: { select: { userId: true } },
    },
  });

  const userIds = Array.from(new Set(watchingUsers.map((w) => w.watchList.userId)));

  const inputs: CreateNotificationInput[] = userIds.map((userId) => ({
    userId,
    type: "TRADE_ALERT" as NotificationType,
    title: `Trade Alert: ${playerName}`,
    message,
    link: `/players/${playerId}`,
    playerId,
  }));

  await createBulkNotifications(inputs);
  return inputs.length;
}

/**
 * Broadcast a notification to all users (admin action).
 */
export async function broadcastNotification(
  title: string,
  message: string,
  type: NotificationType = "SYSTEM",
  link?: string,
) {
  const allUsers = await prisma.user.findMany({
    select: { id: true },
  });

  const inputs: CreateNotificationInput[] = allUsers.map((u) => ({
    userId: u.id,
    type,
    title,
    message,
    link,
  }));

  await createBulkNotifications(inputs);
  return inputs.length;
}
