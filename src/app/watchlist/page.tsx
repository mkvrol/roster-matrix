"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/page-header";
import { ValueBadge } from "@/components/ui/value-badge";
import {
  Star,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  List,
  Bell,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react";

// ── Types ──

type SortKey = "name" | "score" | "change" | "aav";
type SortDir = "asc" | "desc";

// ── Helpers ──

function fmtCap(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${abs}`;
}

// ── Main page ──

export default function WatchListPage() {
  const router = useRouter();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: lists, isLoading: listsLoading } =
    trpc.watchlist.getLists.useQuery(undefined, { staleTime: 5 * 60 * 1000 });

  const { data: selectedList, isLoading: listLoading } =
    trpc.watchlist.getList.useQuery(
      { id: selectedListId! },
      { enabled: !!selectedListId, staleTime: 5 * 60 * 1000 },
    );

  const createList = trpc.watchlist.createList.useMutation({
    onSuccess: (data) => {
      utils.watchlist.getLists.invalidate();
      setSelectedListId(data.id);
      setNewListName("");
      toast({ variant: "success", title: "Watch list created" });
    },
  });

  const deleteList = trpc.watchlist.deleteList.useMutation({
    onSuccess: () => {
      utils.watchlist.getLists.invalidate();
      setSelectedListId(null);
      toast({ variant: "success", title: "Watch list deleted" });
    },
  });

  const removePlayer = trpc.watchlist.removePlayer.useMutation({
    onMutate: async (input) => {
      await utils.watchlist.getList.cancel({ id: input.watchListId });
      const previous = utils.watchlist.getList.getData({ id: input.watchListId });
      if (previous) {
        utils.watchlist.getList.setData({ id: input.watchListId }, {
          ...previous,
          players: previous.players.filter((p) => p.playerId !== input.playerId),
        });
      }
      return { previous };
    },
    onError: (_err, input, context) => {
      if (context?.previous) {
        utils.watchlist.getList.setData({ id: input.watchListId }, context.previous);
      }
    },
    onSettled: () => {
      if (selectedListId) {
        utils.watchlist.getList.invalidate({ id: selectedListId });
        utils.watchlist.getLists.invalidate();
      }
    },
    onSuccess: () => {
      toast({ variant: "success", title: "Player removed" });
    },
  });

  // Auto-select first list when loaded
  if (lists && lists.length > 0 && !selectedListId) {
    setSelectedListId(lists[0].id);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Watch Lists"
        subtitle="Track players and monitor value changes"
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <div className="w-full shrink-0 space-y-3 lg:w-64">
          {/* Create new form */}
          <div className="rounded-md border border-border-subtle bg-surface-1 p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newListName.trim()) {
                  createList.mutate({ name: newListName.trim() });
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="New list name..."
                className="min-w-0 flex-1 rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-data-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
              />
              <button
                type="submit"
                disabled={!newListName.trim() || createList.isPending}
                className="rounded bg-accent px-2 py-1.5 text-data-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>

          {/* List of watch lists */}
          {listsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-md border border-border-subtle bg-surface-1"
                />
              ))}
            </div>
          ) : lists && lists.length > 0 ? (
            <div className="space-y-1">
              {lists.map((list) => (
                <div
                  key={list.id}
                  className={cn(
                    "group flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 transition-colors",
                    selectedListId === list.id
                      ? "border-accent bg-surface-2 text-text-primary"
                      : "border-border-subtle bg-surface-1 text-text-secondary hover:bg-surface-2",
                  )}
                  onClick={() => setSelectedListId(list.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Star className="h-3 w-3 shrink-0 text-text-muted" />
                      <span className="truncate text-data-sm font-medium">
                        {list.name}
                      </span>
                    </div>
                    <span className="ml-[18px] text-data-xs text-text-muted">
                      {list._count.players}{" "}
                      {list._count.players === 1 ? "player" : "players"}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteList.mutate({ id: list.id });
                    }}
                    className="rounded p-1 text-text-muted opacity-0 transition-all hover:bg-surface-3 hover:text-danger group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-border-subtle bg-surface-1 px-3 py-6 text-center">
              <List className="mx-auto h-6 w-6 text-text-muted" />
              <p className="mt-2 text-data-sm text-text-muted">
                No watch lists yet
              </p>
              <p className="mt-0.5 text-data-xs text-text-muted">
                Create one above to get started
              </p>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {listLoading && selectedListId ? (
            <div className="space-y-3">
              <div className="h-8 w-48 animate-pulse rounded bg-surface-1" />
              <div className="overflow-auto rounded-md border border-border-subtle">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="border-b border-border-subtle px-3 py-2">
                    <div className="h-5 animate-pulse rounded bg-surface-2" />
                  </div>
                ))}
              </div>
            </div>
          ) : selectedList ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  {selectedList.name}
                </h2>
                {selectedList.description && (
                  <p className="mt-0.5 text-data-sm text-text-muted">
                    {selectedList.description}
                  </p>
                )}
              </div>

              {/* Alerts for significant score changes */}
              {(() => {
                const alerts = selectedList.players.filter((p) => {
                  if (p.currentScore == null || p.scoreWhenAdded == null) return false;
                  return Math.abs(p.currentScore - p.scoreWhenAdded) >= 5 && !dismissedAlerts.has(p.playerId);
                });
                if (alerts.length === 0) return null;
                return (
                  <div className="space-y-2">
                    {alerts.map((p) => {
                      const delta = p.currentScore! - p.scoreWhenAdded!;
                      const up = delta > 0;
                      return (
                        <div
                          key={p.playerId}
                          className="flex items-center justify-between rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-warning" />
                            <span className="text-data-sm font-medium text-text-primary">
                              {p.name}
                            </span>
                            <span
                              className={cn(
                                "inline-flex items-center gap-0.5 text-data-sm font-medium",
                                up ? "text-success" : "text-danger",
                              )}
                            >
                              {up ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : (
                                <ArrowDown className="h-3 w-3" />
                              )}
                              {up ? "+" : ""}
                              {delta}
                            </span>
                            <span className="text-data-xs text-text-muted">
                              since added
                            </span>
                          </div>
                          <button
                            onClick={() =>
                              setDismissedAlerts((prev) => {
                                const next = new Set(prev);
                                next.add(p.playerId);
                                return next;
                              })
                            }
                            className="rounded p-1 text-text-muted transition-colors hover:bg-yellow-500/20 hover:text-text-primary"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {selectedList.players.length > 0 ? (
                <div className="overflow-auto rounded-md border border-border-subtle">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border-subtle bg-surface-1">
                        <th
                          className="cursor-pointer select-none px-3 py-2.5 text-left text-data-xs font-medium uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary"
                          onClick={() => {
                            if (sortKey === "name") setSortDir(sortDir === "asc" ? "desc" : "asc");
                            else { setSortKey("name"); setSortDir("asc"); }
                          }}
                        >
                          <span className="inline-flex items-center gap-1">
                            Player
                            {sortKey === "name" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                          </span>
                        </th>
                        <th className="px-3 py-2.5 text-left text-data-xs font-medium uppercase tracking-wider text-text-muted" style={{ width: "55px" }}>
                          POS
                        </th>
                        <th className="px-3 py-2.5 text-left text-data-xs font-medium uppercase tracking-wider text-text-muted" style={{ width: "60px" }}>
                          Team
                        </th>
                        <th className="px-3 py-2.5 text-right text-data-xs font-medium uppercase tracking-wider text-text-muted" style={{ width: "55px" }}>
                          Age
                        </th>
                        <th
                          className="cursor-pointer select-none px-3 py-2.5 text-right text-data-xs font-medium uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary"
                          style={{ width: "90px" }}
                          onClick={() => {
                            if (sortKey === "aav") setSortDir(sortDir === "asc" ? "desc" : "asc");
                            else { setSortKey("aav"); setSortDir("desc"); }
                          }}
                        >
                          <span className="inline-flex items-center justify-end gap-1">
                            AAV
                            {sortKey === "aav" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                          </span>
                        </th>
                        <th
                          className="cursor-pointer select-none px-3 py-2.5 text-right text-data-xs font-medium uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary"
                          style={{ width: "120px" }}
                          onClick={() => {
                            if (sortKey === "score") setSortDir(sortDir === "asc" ? "desc" : "asc");
                            else { setSortKey("score"); setSortDir("desc"); }
                          }}
                        >
                          <span className="inline-flex items-center justify-end gap-1">
                            Current Score
                            {sortKey === "score" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                          </span>
                        </th>
                        <th className="px-3 py-2.5 text-right text-data-xs font-medium uppercase tracking-wider text-text-muted" style={{ width: "80px" }}>
                          When Added
                        </th>
                        <th
                          className="cursor-pointer select-none px-3 py-2.5 text-right text-data-xs font-medium uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary"
                          style={{ width: "80px" }}
                          onClick={() => {
                            if (sortKey === "change") setSortDir(sortDir === "asc" ? "desc" : "asc");
                            else { setSortKey("change"); setSortDir("desc"); }
                          }}
                        >
                          <span className="inline-flex items-center justify-end gap-1">
                            Change
                            {sortKey === "change" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                          </span>
                        </th>
                        <th className="px-3 py-2.5 text-right text-data-xs font-medium uppercase tracking-wider text-text-muted" style={{ width: "40px" }}>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...selectedList.players]
                        .sort((a, b) => {
                          const dir = sortDir === "asc" ? 1 : -1;
                          switch (sortKey) {
                            case "name":
                              return dir * a.name.localeCompare(b.name);
                            case "score":
                              return dir * ((a.currentScore ?? 0) - (b.currentScore ?? 0));
                            case "change": {
                              const da = (a.currentScore ?? 0) - (a.scoreWhenAdded ?? 0);
                              const db = (b.currentScore ?? 0) - (b.scoreWhenAdded ?? 0);
                              return dir * (da - db);
                            }
                            case "aav":
                              return dir * (a.aav - b.aav);
                            default:
                              return 0;
                          }
                        })
                        .map((player) => {
                        const delta =
                          player.currentScore != null &&
                          player.scoreWhenAdded != null
                            ? player.currentScore - player.scoreWhenAdded
                            : null;

                        return (
                          <tr
                            key={player.entryId}
                            onClick={() =>
                              router.push(`/players/${player.playerId}`)
                            }
                            className="cursor-pointer border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-2"
                          >
                            <td className="px-3 py-2">
                              <span className="text-data-sm font-medium text-text-primary">
                                {player.name}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono text-data-sm text-text-secondary">
                              {player.position}
                            </td>
                            <td className="px-3 py-2 font-mono text-data-sm text-text-secondary">
                              {player.team ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                              {player.age}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                              {fmtCap(player.aav)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {player.currentScore != null ? (
                                <ValueBadge
                                  score={player.currentScore}
                                  size="sm"
                                />
                              ) : (
                                <span className="text-data-xs text-text-muted">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                              {player.scoreWhenAdded ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {delta != null && delta !== 0 ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-0.5 font-mono text-data-sm font-medium",
                                    delta > 0
                                      ? "text-success"
                                      : "text-danger",
                                  )}
                                >
                                  {delta > 0 ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3" />
                                  )}
                                  {delta > 0 ? "+" : ""}
                                  {delta}
                                </span>
                              ) : (
                                <span className="text-data-xs text-text-muted">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removePlayer.mutate({
                                    watchListId: selectedList.id,
                                    playerId: player.playerId,
                                  });
                                }}
                                className="rounded p-1 text-text-muted transition-colors hover:bg-surface-3 hover:text-danger"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-md border border-border-subtle bg-surface-1 px-3 py-10 text-center">
                  <Star className="mx-auto h-8 w-8 text-text-muted" />
                  <p className="mt-2 text-data-sm text-text-muted">
                    No players in this list yet
                  </p>
                  <p className="mt-0.5 text-data-xs text-text-muted">
                    Add players from their detail page
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-[40vh] items-center justify-center rounded-md border border-border-subtle bg-surface-1">
              <div className="text-center">
                <Star className="mx-auto h-8 w-8 text-text-muted" />
                <p className="mt-2 text-data-sm text-text-muted">
                  Select or create a watch list to get started
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
