"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/page-header";
import { Shield, Send, AlertTriangle, BarChart3, Search, X, RefreshCw, Users, Activity, ArrowLeftRight, Loader2 } from "lucide-react";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  SCORE_CHANGE: { label: "Score Changes", color: "text-info" },
  TRADE_ALERT: { label: "Trade Alerts", color: "text-warning" },
  CONTRACT_UPDATE: { label: "Contract Updates", color: "text-success" },
  GAME_UPDATE: { label: "Game Updates", color: "text-purple" },
  SYSTEM: { label: "System", color: "text-accent" },
};

export default function AdminPage() {
  const { data: session } = useSession();
  const { toast } = useToast();

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastLink, setBroadcastLink] = useState("");

  // Trade alert state
  const [playerQuery, setPlayerQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; fullName: string } | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [tradeMessage, setTradeMessage] = useState("");

  const handleSearch = (value: string) => {
    setPlayerQuery(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => setDebouncedQuery(value), 300);
    setDebounceTimer(timer);
  };

  const { data: playerResults } = trpc.compare.searchPlayers.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 },
  );

  const { data: stats } = trpc.notification.getStats.useQuery(undefined, {
    staleTime: 60 * 1000,
  });

  const broadcastMutation = trpc.notification.broadcast.useMutation({
    onSuccess: (data) => {
      toast({ variant: "success", title: `Broadcast sent to ${data.delivered} users` });
      setBroadcastTitle("");
      setBroadcastMessage("");
      setBroadcastLink("");
    },
  });

  const tradeAlertMutation = trpc.notification.createTradeAlert.useMutation({
    onSuccess: (data) => {
      toast({ variant: "success", title: `Trade alert sent to ${data.delivered} users` });
      setSelectedPlayer(null);
      setTradeMessage("");
      setPlayerQuery("");
      setDebouncedQuery("");
    },
  });

  if ((session?.user as any)?.role !== "ADMIN") {
    return (
      <div className="flex h-full items-center justify-center bg-surface-0">
        <div className="flex flex-col items-center gap-3 text-center">
          <Shield className="h-10 w-10 text-text-muted" />
          <h2 className="text-lg font-semibold text-text-primary">Access Denied</h2>
          <p className="text-sm text-text-muted">You do not have admin privileges.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto bg-surface-0 p-6">
      <PageHeader
        title="Admin Panel"
        subtitle="Manage notifications and monitor system stats"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Broadcast Notification */}
        <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
          <div className="flex items-center gap-3 mb-4">
            <Send className="h-4 w-4 text-text-muted" />
            <h3 className="text-sm font-medium text-text-primary">Broadcast Notification</h3>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Title"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              className="w-full rounded border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
            />
            <textarea
              placeholder="Message"
              rows={3}
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              className="w-full rounded border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent resize-none"
            />
            <input
              type="text"
              placeholder="Link (optional)"
              value={broadcastLink}
              onChange={(e) => setBroadcastLink(e.target.value)}
              className="w-full rounded border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
            />
            <button
              onClick={() =>
                broadcastMutation.mutate({
                  title: broadcastTitle,
                  message: broadcastMessage,
                  link: broadcastLink || undefined,
                })
              }
              disabled={!broadcastTitle || !broadcastMessage || broadcastMutation.isPending}
              className="flex items-center gap-1.5 rounded bg-accent px-4 py-2 text-data-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              Send to All Users
            </button>
          </div>
        </div>

        {/* Trade Alert */}
        <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-4 w-4 text-text-muted" />
            <h3 className="text-sm font-medium text-text-primary">Trade Alert</h3>
          </div>

          <div className="space-y-3">
            {selectedPlayer ? (
              <div className="flex items-center justify-between rounded border border-border-subtle bg-surface-2 px-3 py-2">
                <span className="text-data-sm text-text-primary">{selectedPlayer.fullName}</span>
                <button
                  onClick={() => setSelectedPlayer(null)}
                  className="text-text-muted hover:text-text-secondary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 rounded border border-border-subtle bg-surface-2 px-3 py-2">
                  <Search className="h-3.5 w-3.5 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Search player..."
                    value={playerQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full bg-transparent text-data-sm text-text-primary outline-none placeholder:text-text-muted"
                  />
                </div>
                {playerResults && playerResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded border border-border-subtle bg-surface-2 py-1 shadow-lg">
                    {playerResults.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPlayer({ id: p.id, fullName: p.fullName });
                          setPlayerQuery("");
                          setDebouncedQuery("");
                        }}
                        className="w-full px-3 py-1.5 text-left text-data-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                      >
                        {p.fullName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <textarea
              placeholder="Trade alert message"
              rows={3}
              value={tradeMessage}
              onChange={(e) => setTradeMessage(e.target.value)}
              className="w-full rounded border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent resize-none"
            />
            <button
              onClick={() =>
                tradeAlertMutation.mutate({
                  playerId: selectedPlayer!.id,
                  message: tradeMessage,
                })
              }
              disabled={!selectedPlayer || !tradeMessage || tradeAlertMutation.isPending}
              className="flex items-center gap-1.5 rounded bg-accent px-4 py-2 text-data-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Send Trade Alert
            </button>
          </div>
        </div>
      </div>

      {/* Data Sync Controls */}
      <DataSyncPanel toast={toast} />

      {/* Notification Stats */}
      <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="h-4 w-4 text-text-muted" />
          <h3 className="text-sm font-medium text-text-primary">Notification Stats</h3>
        </div>

        {stats ? (
          <div className="space-y-4">
            <div className="flex gap-6">
              <div>
                <p className="text-data-xs text-text-muted">Total Sent</p>
                <p className="text-lg font-semibold text-text-primary">{stats.total}</p>
              </div>
              <div>
                <p className="text-data-xs text-text-muted">Total Unread</p>
                <p className="text-lg font-semibold text-text-primary">{stats.unread}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-data-xs text-text-muted">By Type</p>
              <div className="flex flex-wrap gap-2">
                {stats.byType?.map((entry: any) => {
                  const meta = TYPE_LABELS[entry.type] ?? {
                    label: entry.type,
                    color: "text-text-secondary",
                  };
                  return (
                    <span
                      key={entry.type}
                      className={cn(
                        "rounded-full border border-border-subtle bg-surface-2 px-3 py-1 text-data-xs font-medium",
                        meta.color,
                      )}
                    >
                      {meta.label}: {entry.count}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-data-sm text-text-muted">Loading stats…</p>
        )}
      </div>
    </div>
  );
}

function DataSyncPanel({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [rosterLoading, setRosterLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [injuryLoading, setInjuryLoading] = useState(false);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ job: string; data: any } | null>(null);

  const triggerSync = async (
    path: string,
    label: string,
    setLoading: (v: boolean) => void,
  ) => {
    setLoading(true);
    setLastResult(null);
    try {
      const res = await fetch(`/api/cron/${path}`);
      const data = await res.json();
      if (res.ok) {
        toast({ variant: "success", title: `${label} completed` });
        setLastResult({ job: label, data });
      } else {
        toast({ variant: "error", title: `${label} failed: ${data.error ?? "Unknown"}` });
      }
    } catch (error) {
      toast({ variant: "error", title: `${label} failed: ${error instanceof Error ? error.message : "Network error"}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
      <div className="flex items-center gap-3 mb-4">
        <RefreshCw className="h-4 w-4 text-text-muted" />
        <h3 className="text-sm font-medium text-text-primary">Data Sync</h3>
        <span className="text-data-xs text-text-muted">Manually trigger cron jobs</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          onClick={() => triggerSync("roster-sync", "Roster Sync", setRosterLoading)}
          disabled={rosterLoading || statsLoading || injuryLoading || tradeLoading}
          className="flex items-center gap-2 rounded border border-border-subtle bg-surface-2 px-4 py-3 text-data-sm font-medium text-text-primary transition-colors hover:bg-surface-3 disabled:opacity-50"
        >
          {rosterLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4 text-info" />}
          <div className="text-left">
            <p>Roster Sync</p>
            <p className="text-data-xs font-normal text-text-muted">Rosters + trade detection</p>
          </div>
        </button>

        <button
          onClick={() => triggerSync("stats-sync", "Stats Sync", setStatsLoading)}
          disabled={rosterLoading || statsLoading || injuryLoading || tradeLoading}
          className="flex items-center gap-2 rounded border border-border-subtle bg-surface-2 px-4 py-3 text-data-sm font-medium text-text-primary transition-colors hover:bg-surface-3 disabled:opacity-50"
        >
          {statsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4 text-success" />}
          <div className="text-left">
            <p>Stats Sync</p>
            <p className="text-data-xs font-normal text-text-muted">Stats + value scores</p>
          </div>
        </button>

        <button
          onClick={() => triggerSync("injury-sync", "Injury Sync", setInjuryLoading)}
          disabled={rosterLoading || statsLoading || injuryLoading || tradeLoading}
          className="flex items-center gap-2 rounded border border-border-subtle bg-surface-2 px-4 py-3 text-data-sm font-medium text-text-primary transition-colors hover:bg-surface-3 disabled:opacity-50"
        >
          {injuryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4 text-warning" />}
          <div className="text-left">
            <p>Injury Sync</p>
            <p className="text-data-xs font-normal text-text-muted">Injury status updates</p>
          </div>
        </button>

        <button
          onClick={() => triggerSync("trade-sync", "Trade Sync", setTradeLoading)}
          disabled={rosterLoading || statsLoading || injuryLoading || tradeLoading}
          className="flex items-center gap-2 rounded border border-border-subtle bg-surface-2 px-4 py-3 text-data-sm font-medium text-text-primary transition-colors hover:bg-surface-3 disabled:opacity-50"
        >
          {tradeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4 text-accent" />}
          <div className="text-left">
            <p>Trade Sync</p>
            <p className="text-data-xs font-normal text-text-muted">NHL trade details</p>
          </div>
        </button>
      </div>

      {lastResult && (
        <div className="mt-3 rounded bg-surface-2 p-3">
          <p className="mb-1 text-data-xs font-medium text-text-secondary">{lastResult.job} Result:</p>
          <pre className="max-h-32 overflow-auto text-data-xs text-text-muted">
            {JSON.stringify(lastResult.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
