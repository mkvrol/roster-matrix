"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";

export function useNotifications() {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const eventSourceRef = useRef<EventSource | null>(null);

  const { data: unreadCount = 0 } =
    trpc.notification.getUnreadCount.useQuery(undefined, {
      enabled: !!session?.user,
    });

  const { data: notificationsData } =
    trpc.notification.getNotifications.useQuery(
      { limit: 20 },
      { enabled: !!session?.user },
    );

  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.getNotifications.invalidate();
    },
  });

  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.getNotifications.invalidate();
    },
  });

  // Connect to SSE
  useEffect(() => {
    if (!session?.user) return;

    const es = new EventSource("/api/events");
    eventSourceRef.current = es;

    es.addEventListener("NOTIFICATION", () => {
      // Re-fetch counts and list when a new notification arrives
      utils.notification.getUnreadCount.invalidate();
      utils.notification.getNotifications.invalidate();
    });

    es.onerror = () => {
      // EventSource will auto-reconnect
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [session?.user, utils]);

  const handleMarkRead = useCallback(
    (id: string) => {
      markRead.mutate({ id });
    },
    [markRead],
  );

  const handleMarkAllRead = useCallback(() => {
    markAllRead.mutate();
  }, [markAllRead]);

  return {
    notifications: notificationsData?.items ?? [],
    unreadCount,
    markRead: handleMarkRead,
    markAllRead: handleMarkAllRead,
  };
}
