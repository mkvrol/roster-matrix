"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/lib/use-notifications";
import {
  Bell,
  TrendingUp,
  ArrowLeftRight,
  FileText,
  BarChart3,
  CheckCheck,
} from "lucide-react";

function timeAgo(date: Date | string): string {
  const now = Date.now();
  const d = new Date(date).getTime();
  const seconds = Math.floor((now - d) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  SCORE_CHANGE: TrendingUp,
  TRADE_ALERT: ArrowLeftRight,
  CONTRACT_UPDATE: FileText,
  GAME_UPDATE: BarChart3,
  SYSTEM: Bell,
};

const TYPE_COLORS: Record<string, string> = {
  SCORE_CHANGE: "text-info",
  TRADE_ALERT: "text-warning",
  CONTRACT_UPDATE: "text-success",
  GAME_UPDATE: "text-purple",
  SYSTEM: "text-accent",
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotifications();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleNotificationClick = (notification: {
    id: string;
    link: string | null;
    isRead: boolean;
  }) => {
    if (!notification.isRead) markRead(notification.id);
    if (notification.link) {
      router.push(notification.link);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative rounded-md p-2 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-secondary"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[calc(100vw-2rem)] rounded-md border border-border-subtle bg-surface-2 shadow-lg sm:w-80">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2.5">
            <h3 className="text-data-sm font-medium text-text-primary">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="flex items-center gap-1 text-data-xs text-text-muted transition-colors hover:text-accent"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>
          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <Bell className="mx-auto h-6 w-6 text-text-muted" />
                <p className="mt-2 text-data-sm text-text-muted">
                  No notifications yet
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? Bell;
                const color = TYPE_COLORS[n.type] ?? "text-text-muted";
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "flex w-full gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-3",
                      !n.isRead && "bg-surface-1/50",
                    )}
                  >
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", color)} />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-data-sm",
                          n.isRead
                            ? "text-text-secondary"
                            : "font-medium text-text-primary",
                        )}
                      >
                        {n.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-data-xs text-text-muted">
                        {n.message}
                      </p>
                      <p className="mt-0.5 text-data-xs text-text-muted">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    {!n.isRead && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
