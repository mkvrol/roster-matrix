"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { ValueGauge } from "@/components/ui/value-gauge";
import { ValueBadge } from "@/components/ui/value-badge";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { Search, X, Plus, GitCompareArrows } from "lucide-react";
import { usePageView } from "@/lib/use-track";

// ── Constants ──

const PLAYER_COLORS = ["#dc2626", "#60a5fa", "#10b981", "#fbbf24"];

const RADAR_DIMENSIONS = [
  { key: "scoringComponent", label: "Scoring" },
  { key: "fiveOnFiveComponent", label: "5v5 Impact" },
  { key: "specialTeamsComponent", label: "Special Teams" },
  { key: "durabilityComponent", label: "Durability" },
  { key: "efficiencyComponent", label: "Efficiency" },
  { key: "ageCurveComponent", label: "Age Curve" },
] as const;

// ── Helpers ──

function fmtCap(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${abs}`;
}

function getScoreColor(score: number): string {
  if (score >= 90) return "#10b981";
  if (score >= 75) return "#60a5fa";
  if (score >= 60) return "#fbbf24";
  if (score >= 40) return "#a78bfa";
  return "#ef4444";
}

// ── Types ──

interface SelectedPlayer {
  id: string;
  fullName: string;
  position: string;
  teamAbbreviation: string | null;
  headshotUrl: string | null;
}

// ── Main Page ──

export default function ComparePage() {
  usePageView("/compare");
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-surface-1" />}>
      <ComparePageContent />
    </Suspense>
  );
}

function ComparePageContent() {
  const searchParams = useSearchParams();
  const [selectedPlayers, setSelectedPlayers] = useState<SelectedPlayer[]>([]);
  const playerIds = selectedPlayers.map((p) => p.id);

  // Seed from ?players= query param
  const seedId = searchParams.get("players");
  const { data: seedProfile } = trpc.player.getProfile.useQuery(
    { playerId: seedId! },
    { enabled: !!seedId && selectedPlayers.length === 0, staleTime: 60 * 60 * 1000 },
  );

  useEffect(() => {
    if (!seedProfile || selectedPlayers.length > 0) return;
    setSelectedPlayers([{
      id: seedProfile.id,
      fullName: seedProfile.fullName,
      position: seedProfile.position,
      teamAbbreviation: seedProfile.team?.abbreviation ?? null,
      headshotUrl: seedProfile.headshotUrl ?? null,
    }]);
  }, [seedProfile, selectedPlayers.length]);

  const { data: comparison, isLoading } =
    trpc.compare.getComparison.useQuery(
      { playerIds },
      { enabled: playerIds.length >= 2, staleTime: 15 * 60 * 1000 },
    );

  const trackMutation = trpc.analytics.track.useMutation();
  const addPlayer = (player: SelectedPlayer) => {
    if (selectedPlayers.length >= 4) return;
    if (selectedPlayers.some((p) => p.id === player.id)) return;
    const next = [...selectedPlayers, player];
    setSelectedPlayers(next);
    if (next.length >= 2) {
      trackMutation.mutate({
        eventType: "COMPARISON_CREATED",
        metadata: { playerIds: next.map((p) => p.id) },
      });
    }
  };

  const removePlayer = (id: string) => {
    setSelectedPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Player Comparison"
        subtitle="Compare up to 4 players side by side"
        actions={
          <div className="flex items-center gap-1.5 text-text-muted">
            <GitCompareArrows className="h-4 w-4" />
            <span className="text-data-xs">
              {selectedPlayers.length}/4 selected
            </span>
          </div>
        }
      />

      {/* Player Picker */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {selectedPlayers.map((player, i) => (
          <div
            key={player.id}
            className="relative flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-1 p-3"
          >
            <div
              className="h-10 w-10 shrink-0 rounded-full bg-surface-2"
              style={{ borderLeft: `3px solid ${PLAYER_COLORS[i]}` }}
            >
              {player.headshotUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={player.headshotUrl}
                  alt={player.fullName}
                  className="h-10 w-10 rounded-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">
                {player.fullName}
              </p>
              <p className="text-data-xs text-text-muted">
                {player.position}
                {player.teamAbbreviation
                  ? ` · ${player.teamAbbreviation}`
                  : ""}
              </p>
            </div>
            <button
              onClick={() => removePlayer(player.id)}
              className="absolute right-2 top-2 rounded p-0.5 text-text-muted transition-colors hover:text-danger"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {selectedPlayers.length < 4 && (
          <PlayerSearchSlot onSelect={addPlayer} />
        )}
      </div>

      {/* Comparison Content */}
      {selectedPlayers.length < 2 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border-subtle bg-surface-1 p-12 text-center">
          <GitCompareArrows className="mb-3 h-8 w-8 text-text-muted" />
          <p className="text-sm text-text-muted">
            Select at least 2 players to compare
          </p>
        </div>
      )}

      {isLoading && selectedPlayers.length >= 2 && (
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-lg border border-border-subtle bg-surface-1" />
          <div className="h-64 animate-pulse rounded-lg border border-border-subtle bg-surface-1" />
          <div className="h-48 animate-pulse rounded-lg border border-border-subtle bg-surface-1" />
        </div>
      )}

      {comparison && comparison.length >= 2 && (
        <>
          <ValueScoreHeader players={comparison} />
          <RadarComparison players={comparison} />
          <StatComparisonTable players={comparison} />
          <ContractValueSection players={comparison} />
        </>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Player Search Slot
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function PlayerSearchSlot({
  onSelect,
}: {
  onSelect: (player: SelectedPlayer) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      setDebouncedQuery(value);
    }, 300);
    setDebounceTimer(timer);
  };

  const { data: results } = trpc.compare.searchPlayers.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 2 },
  );

  const handleSelect = (result: NonNullable<typeof results>[number]) => {
    onSelect({
      id: result.id,
      fullName: result.fullName,
      position: result.position,
      teamAbbreviation: result.teamAbbreviation,
      headshotUrl: result.headshotUrl,
    });
    setOpen(false);
    setQuery("");
    setDebouncedQuery("");
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border-subtle bg-surface-1 p-3 text-sm text-text-muted transition-colors hover:border-accent hover:text-accent"
      >
        <Plus className="h-4 w-4" />
        Add Player
      </button>
    );
  }

  return (
    <div className="relative rounded-lg border border-accent bg-surface-1 p-3">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 shrink-0 text-text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search players..."
          autoFocus
          className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        <button
          onClick={() => {
            setOpen(false);
            setQuery("");
            setDebouncedQuery("");
          }}
          className="text-text-muted hover:text-text-primary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {results && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border-subtle bg-surface-2 shadow-lg">
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelect(result)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-3"
            >
              <div className="h-7 w-7 shrink-0 rounded-full bg-surface-1">
                {result.headshotUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={result.headshotUrl}
                    alt={result.fullName}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text-primary">
                  {result.fullName}
                </p>
                <p className="text-data-xs text-text-muted">
                  {result.position}
                  {result.teamAbbreviation
                    ? ` · ${result.teamAbbreviation}`
                    : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {debouncedQuery.length >= 2 && results && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-border-subtle bg-surface-2 p-3 shadow-lg">
          <p className="text-center text-data-xs text-text-muted">
            No players found
          </p>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Value Score Header
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type ComparisonPlayer = inferRouterOutputs<AppRouter>["compare"]["getComparison"][number];

function ValueScoreHeader({ players }: { players: ComparisonPlayer[] }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <h3 className="mb-4 text-sm font-medium text-text-secondary">
        Value Overview
      </h3>
      <div
        className={cn(
          "grid gap-4",
          players.length === 2 && "grid-cols-2",
          players.length === 3 && "grid-cols-3",
          players.length === 4 && "grid-cols-2 lg:grid-cols-4",
        )}
      >
        {players.map((player, i) => (
          <div
            key={player.id}
            className="flex flex-col items-center gap-2 rounded-lg bg-surface-2 p-4"
            style={{ borderTop: `2px solid ${PLAYER_COLORS[i]}` }}
          >
            <p className="text-sm font-medium text-text-primary">
              {player.fullName}
            </p>
            <p className="text-data-xs text-text-muted">
              {player.position}
              {player.teamAbbreviation
                ? ` · ${player.teamAbbreviation}`
                : ""}
            </p>
            {player.valueScore ? (
              <>
                <ValueGauge score={player.valueScore.overallScore} size={80} />
                <ValueBadge
                  score={player.valueScore.overallScore}
                  size="sm"
                />
                {player.contract && (
                  <p className="text-data-sm font-mono text-text-secondary">
                    {fmtCap(player.contract.aav)}
                  </p>
                )}
                {player.valueScore.leagueRank && (
                  <p className="text-data-xs text-text-muted">
                    League Rank #{player.valueScore.leagueRank}
                  </p>
                )}
              </>
            ) : (
              <p className="text-data-xs text-text-muted">No value score</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Radar Comparison
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function RadarComparison({ players }: { players: ComparisonPlayer[] }) {
  const radarData = useMemo(() => {
    return RADAR_DIMENSIONS.map((dim) => {
      const entry: Record<string, string | number | null> = {
        dimension: dim.label,
      };
      players.forEach((player, i) => {
        const val = player.valueScore
          ? (player.valueScore[
              dim.key as keyof typeof player.valueScore
            ] as number | null)
          : null;
        entry[`player${i}`] = val ?? 0;
      });
      return entry;
    });
  }, [players]);

  const hasData = players.some((p) => p.valueScore);
  if (!hasData) return null;

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <h3 className="mb-4 text-sm font-medium text-text-secondary">
        Value Components
      </h3>
      <div className="flex items-center justify-center gap-4 pb-2">
        {players.map((player, i) => (
          <div key={player.id} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: PLAYER_COLORS[i] }}
            />
            <span className="text-data-xs text-text-muted">
              {player.fullName}
            </span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "#64748b", fontSize: 10 }}
          />
          {players.map((_, i) => (
            <Radar
              key={i}
              dataKey={`player${i}`}
              stroke={PLAYER_COLORS[i]}
              fill={PLAYER_COLORS[i]}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Stat Comparison Table
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface StatRow {
  label: string;
  values: (number | string | null)[];
  higherIsBetter: boolean;
  format?: (v: number) => string;
}

function StatComparisonTable({ players }: { players: ComparisonPlayer[] }) {
  const rows = useMemo(() => {
    const statRows: StatRow[] = [
      // Season stats
      {
        label: "GP",
        values: players.map((p) => p.seasonStats?.gamesPlayed ?? null),
        higherIsBetter: true,
      },
      {
        label: "G",
        values: players.map((p) => p.seasonStats?.goals ?? null),
        higherIsBetter: true,
      },
      {
        label: "A",
        values: players.map((p) => p.seasonStats?.assists ?? null),
        higherIsBetter: true,
      },
      {
        label: "P",
        values: players.map((p) => p.seasonStats?.points ?? null),
        higherIsBetter: true,
      },
      {
        label: "+/-",
        values: players.map((p) => p.seasonStats?.plusMinus ?? null),
        higherIsBetter: true,
      },
      {
        label: "PIM",
        values: players.map((p) => p.seasonStats?.pim ?? null),
        higherIsBetter: false,
      },
      {
        label: "TOI/GP",
        values: players.map((p) => p.seasonStats?.toiPerGame ?? null),
        higherIsBetter: true,
        format: (v) => v.toFixed(1),
      },
      // Advanced stats
      {
        label: "CF%",
        values: players.map((p) => p.advancedStats?.corsiForPct ?? null),
        higherIsBetter: true,
        format: (v) => v.toFixed(1),
      },
      {
        label: "xGF%",
        values: players.map((p) => p.advancedStats?.xGFPct ?? null),
        higherIsBetter: true,
        format: (v) => v.toFixed(1),
      },
      {
        label: "GF%",
        values: players.map((p) => p.advancedStats?.goalsForPct ?? null),
        higherIsBetter: true,
        format: (v) => v.toFixed(1),
      },
      // Contract / value
      {
        label: "AAV",
        values: players.map((p) => p.contract?.aav ?? null),
        higherIsBetter: false,
        format: (v) => fmtCap(v),
      },
      {
        label: "Years Remaining",
        values: players.map((p) => p.contract?.yearsRemaining ?? null),
        higherIsBetter: true,
      },
      {
        label: "Value Score",
        values: players.map(
          (p) => p.valueScore?.overallScore ?? null,
        ),
        higherIsBetter: true,
      },
      {
        label: "WAR",
        values: players.map((p) => p.valueScore?.estimatedWAR ?? null),
        higherIsBetter: true,
        format: (v) => v.toFixed(1),
      },
      {
        label: "Cost/WAR",
        values: players.map((p) => p.valueScore?.costPerWAR ?? null),
        higherIsBetter: false,
        format: (v) => fmtCap(v),
      },
    ];

    return statRows;
  }, [players]);

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <h3 className="mb-4 text-sm font-medium text-text-secondary">
        Stat Comparison
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="pb-2 pr-4 text-left text-data-xs font-medium text-text-muted">
                Stat
              </th>
              {players.map((player, i) => (
                <th
                  key={player.id}
                  className="pb-2 text-right text-data-xs font-medium"
                  style={{ color: PLAYER_COLORS[i] }}
                >
                  {player.fullName.split(" ").pop()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const numericValues = row.values.map((v) =>
                typeof v === "number" ? v : null,
              );
              const validValues = numericValues.filter(
                (v): v is number => v !== null,
              );
              const best = row.higherIsBetter
                ? Math.max(...validValues)
                : Math.min(...validValues);
              const worst = row.higherIsBetter
                ? Math.min(...validValues)
                : Math.max(...validValues);

              return (
                <tr
                  key={row.label}
                  className="border-b border-border-subtle/50"
                >
                  <td className="py-2 pr-4 text-text-muted">{row.label}</td>
                  {row.values.map((val, i) => {
                    const numVal =
                      typeof val === "number" ? val : null;
                    const isBest =
                      numVal !== null &&
                      validValues.length >= 2 &&
                      numVal === best;
                    const isWorst =
                      numVal !== null &&
                      players.length >= 3 &&
                      validValues.length >= 3 &&
                      numVal === worst;

                    const display =
                      numVal !== null
                        ? row.format
                          ? row.format(numVal)
                          : String(numVal)
                        : "—";

                    return (
                      <td
                        key={i}
                        className={cn(
                          "py-2 text-right font-mono tabular-nums",
                          isBest && "text-success",
                          isWorst && "text-danger",
                          !isBest && !isWorst && "text-text-primary",
                        )}
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Contract Value Section
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ContractValueSection({
  players,
}: {
  players: ComparisonPlayer[];
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 p-4">
      <h3 className="mb-4 text-sm font-medium text-text-secondary">
        Contract Details
      </h3>
      <div
        className={cn(
          "grid gap-4",
          players.length === 2 && "grid-cols-2",
          players.length === 3 && "grid-cols-3",
          players.length === 4 && "grid-cols-2 lg:grid-cols-4",
        )}
      >
        {players.map((player, i) => (
          <div
            key={player.id}
            className="rounded-lg bg-surface-2 p-4"
            style={{ borderTop: `2px solid ${PLAYER_COLORS[i]}` }}
          >
            <p className="mb-3 text-sm font-medium text-text-primary">
              {player.fullName}
            </p>
            {player.contract ? (
              <div className="space-y-2">
                <ContractRow
                  label="AAV"
                  value={fmtCap(player.contract.aav)}
                />
                <ContractRow
                  label="Total Value"
                  value={fmtCap(player.contract.totalValue)}
                />
                <ContractRow
                  label="Years Remaining"
                  value={String(player.contract.yearsRemaining)}
                />
                <div className="flex items-center gap-1.5">
                  <span className="text-data-xs text-text-muted">
                    Trade Protection
                  </span>
                  <div className="flex gap-1">
                    {player.contract.hasNMC && (
                      <span className="rounded bg-danger-muted px-1.5 py-0.5 text-data-xs font-medium text-danger">
                        NMC
                      </span>
                    )}
                    {player.contract.hasNTC && (
                      <span className="rounded bg-warning-muted px-1.5 py-0.5 text-data-xs font-medium text-warning">
                        NTC
                      </span>
                    )}
                    {!player.contract.hasNMC &&
                      !player.contract.hasNTC && (
                        <span className="text-data-xs text-text-muted">
                          None
                        </span>
                      )}
                  </div>
                </div>
                {player.contract.signingType && (
                  <ContractRow
                    label="Signing Type"
                    value={player.contract.signingType}
                  />
                )}
              </div>
            ) : (
              <p className="text-data-xs text-text-muted">
                No contract data
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ContractRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-data-xs text-text-muted">{label}</span>
      <span className="font-mono text-data-sm text-text-primary">
        {value}
      </span>
    </div>
  );
}
