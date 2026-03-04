// ──────────────────────────────────────────────
// Roster Matrix — Analytics Tracking Service
// Lightweight event tracking with batch inserts
// ──────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// ── Event types ──

export type AnalyticsEventType =
  | "PAGE_VIEW"
  | "PLAYER_VIEW"
  | "TEAM_VIEW"
  | "SEARCH"
  | "TRADE_CREATED"
  | "TRADE_SAVED"
  | "AI_SCOUT_QUERY"
  | "AI_BRIEFING_GENERATED"
  | "AI_NEGOTIATION_VIEWED"
  | "COMPARISON_CREATED"
  | "WATCHLIST_ADDED"
  | "WATCHLIST_REMOVED"
  | "REPORT_EXPORTED"
  | "LOGIN"
  | "DEMO_LOGIN";

// ── Batch buffer ──

interface BufferedEvent {
  eventType: string;
  userId?: string;
  metadata?: Prisma.InputJsonValue;
  timestamp: Date;
}

const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 5_000;

let buffer: BufferedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  if (buffer.length === 0) return;

  const events = buffer.splice(0, buffer.length);
  try {
    await prisma.analyticsEvent.createMany({
      data: events.map((e) => ({
        eventType: e.eventType,
        userId: e.userId ?? null,
        metadata: e.metadata ?? undefined,
        timestamp: e.timestamp,
      })),
    });
  } catch (err) {
    // Analytics should never crash the app — log and move on
    console.error("[analytics] Failed to flush events:", err);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

// ── Public API ──

export function trackEvent(
  eventType: AnalyticsEventType,
  userId?: string | null,
  metadata?: Record<string, unknown>,
) {
  buffer.push({
    eventType,
    userId: userId ?? undefined,
    metadata: metadata as Prisma.InputJsonValue,
    timestamp: new Date(),
  });

  if (buffer.length >= BATCH_SIZE) {
    flush();
  } else {
    scheduleFlush();
  }
}
