"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { usePageView } from "@/lib/use-track";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/page-header";
import { ValueBadge } from "@/components/ui/value-badge";
import { TeamLogo } from "@/components/ui/team-logo";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";
import {
  ArrowLeftRight,
  Search,
  X,
  Plus,
  ShieldAlert,
  Save,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  Lightbulb,
  FileText,
  Sparkles,
  Loader2,
  Target,
} from "lucide-react";

// ── Types ──

type RouterOutput = inferRouterOutputs<AppRouter>;
type SearchResult = RouterOutput["trade"]["searchPlayers"][number];
type Team = RouterOutput["trade"]["getTeams"][number];

interface TradePlayer {
  playerId: string;
  playerName: string;
  position: string;
  teamAbbreviation: string | null;
  headshotUrl: string | null;
  aav: number;
  valueScore: number | null;
  grade: string | null;
  age: number;
  yearsRemaining: number;
  hasNTC: boolean;
  hasNMC: boolean;
  retainedPct: number;
}

interface DraftPick {
  id: string;
  year: number;
  round: number;
}

interface TradeSide {
  teamId: string | null;
  players: TradePlayer[];
  draftPicks: DraftPick[];
}

const SALARY_CAP = 95_500_000;

// ── Main page ──

export default function TradeAnalyzerPage() {
  usePageView("/trade-analyzer");
  const [sideA, setSideA] = useState<TradeSide>({
    teamId: null,
    players: [],
    draftPicks: [],
  });
  const [sideB, setSideB] = useState<TradeSide>({
    teamId: null,
    players: [],
    draftPicks: [],
  });
  const [saveOpen, setSaveOpen] = useState(false);

  // Default Team A to user's team
  const { data: userTeamId } = trpc.trade.getUserTeam.useQuery();
  useEffect(() => {
    if (userTeamId && !sideA.teamId) {
      setSideA((prev) => ({ ...prev, teamId: userTeamId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userTeamId]);

  const hasPlayers = sideA.players.length > 0 || sideB.players.length > 0;

  const handleReset = () => {
    setSideA({ teamId: userTeamId ?? null, players: [], draftPicks: [] });
    setSideB({ teamId: null, players: [], draftPicks: [] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trade Analyzer"
        subtitle="Simulate trades and evaluate cap impact"
        actions={
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded border border-border-subtle bg-surface-2 px-3 py-1.5 text-data-xs text-text-secondary transition-colors hover:bg-surface-3"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
            <button
              onClick={() => setSaveOpen(true)}
              disabled={!hasPlayers}
              className={cn(
                "flex items-center gap-1.5 rounded px-3 py-1.5 text-data-xs font-medium transition-colors",
                hasPlayers
                  ? "bg-accent text-white hover:bg-accent-hover"
                  : "bg-surface-2 text-text-muted cursor-not-allowed",
              )}
            >
              <Save className="h-3.5 w-3.5" />
              Save Trade
            </button>
          </div>
        }
      />

      {/* Trade builder: 3 columns */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto_1fr]">
        <TradePanel
          label="Team A"
          side={sideA}
          onSideChange={setSideA}
          accent="accent"
        />

        {/* Center divider */}
        <div className="hidden items-center justify-center xl:flex">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-surface-1">
            <ArrowLeftRight className="h-4 w-4 text-text-muted" />
          </div>
        </div>

        <TradePanel
          label="Team B"
          side={sideB}
          onSideChange={setSideB}
          accent="info"
        />
      </div>

      {/* Analysis Panel */}
      {hasPlayers && (
        <AnalysisPanel sideA={sideA} sideB={sideB} />
      )}

      {/* Suggested Trades */}
      {sideA.teamId && (
        <SuggestedTrades
          teamId={sideA.teamId}
          onApply={(suggestion) => {
            setSideB((prev) => ({
              ...prev,
              teamId: suggestion.teamBId,
              players: suggestion.teamBGives.map((p) => ({
                playerId: p.playerId,
                playerName: p.playerName,
                position: p.position,
                teamAbbreviation: suggestion.teamBAbbreviation,
                headshotUrl: null,
                aav: p.aav,
                valueScore: p.valueScore,
                grade: null,
                age: 27,
                yearsRemaining: 0,
                hasNTC: false,
                hasNMC: false,
                retainedPct: 0,
              })),
              draftPicks: [],
            }));
            setSideA((prev) => ({
              ...prev,
              players: suggestion.teamAGives.map((p) => ({
                playerId: p.playerId,
                playerName: p.playerName,
                position: p.position,
                teamAbbreviation: null,
                headshotUrl: null,
                aav: p.aav,
                valueScore: p.valueScore,
                grade: null,
                age: 27,
                yearsRemaining: 0,
                hasNTC: false,
                hasNMC: false,
                retainedPct: 0,
              })),
              draftPicks: [],
            }));
          }}
        />
      )}

      {/* AI Trade Board */}
      {sideA.teamId && <AITradeBoard teamId={sideA.teamId} />}

      {/* Save Modal */}
      {saveOpen && (
        <SaveTradeModal
          sideA={sideA}
          sideB={sideB}
          onClose={() => setSaveOpen(false)}
        />
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Trade Panel (one per side)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function TradePanel({
  label,
  side,
  onSideChange,
  accent,
}: {
  label: string;
  side: TradeSide;
  onSideChange: (s: TradeSide) => void;
  accent: string;
}) {
  const { data: teams } = trpc.trade.getTeams.useQuery();

  const selectedTeam = teams?.find((t) => t.id === side.teamId);

  const addPlayer = (result: SearchResult) => {
    if (side.players.some((p) => p.playerId === result.playerId)) return;
    onSideChange({
      ...side,
      players: [
        ...side.players,
        {
          playerId: result.playerId,
          playerName: result.playerName,
          position: result.position,
          teamAbbreviation: result.teamAbbreviation,
          headshotUrl: result.headshotUrl,
          aav: result.aav,
          valueScore: result.valueScore,
          grade: result.grade,
          age: result.age,
          yearsRemaining: result.yearsRemaining,
          hasNTC: result.hasNTC,
          hasNMC: result.hasNMC,
          retainedPct: 0,
        },
      ],
    });
  };

  const removePlayer = (playerId: string) => {
    onSideChange({
      ...side,
      players: side.players.filter((p) => p.playerId !== playerId),
    });
  };

  const updateRetained = (playerId: string, pct: number) => {
    onSideChange({
      ...side,
      players: side.players.map((p) =>
        p.playerId === playerId ? { ...p, retainedPct: pct } : p,
      ),
    });
  };

  const addDraftPick = (year: number, round: number) => {
    onSideChange({
      ...side,
      draftPicks: [
        ...side.draftPicks,
        { id: `${Date.now()}-${Math.random()}`, year, round },
      ],
    });
  };

  const removeDraftPick = (id: string) => {
    onSideChange({
      ...side,
      draftPicks: side.draftPicks.filter((p) => p.id !== id),
    });
  };

  const totalCapOut = side.players.reduce(
    (s, p) => s + p.aav * (1 - p.retainedPct / 100),
    0,
  );

  return (
    <div className="rounded-md border border-border-subtle bg-surface-1">
      {/* Header */}
      <div
        className={cn(
          "border-b border-border-subtle px-4 py-3",
          accent === "accent" ? "border-l-2 border-l-accent" : "border-l-2 border-l-info",
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedTeam && <TeamLogo teamAbbrev={selectedTeam.abbreviation} size="md" />}
            <span className="text-sm font-medium text-text-primary">{label}</span>
          </div>
          {side.players.length > 0 && (
            <span className="font-mono text-data-xs text-text-muted">
              {fmtCap(totalCapOut)} out
            </span>
          )}
        </div>

        {/* Team selector */}
        <select
          value={side.teamId ?? ""}
          onChange={(e) =>
            onSideChange({
              ...side,
              teamId: e.target.value || null,
              players: [],
              draftPicks: [],
            })
          }
          className="mt-2 w-full rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-data-sm text-text-primary outline-none focus:border-accent"
        >
          <option value="">Select a team…</option>
          {teams?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.abbreviation})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3 p-4">
        {/* Player search */}
        {side.teamId && (
          <PlayerSearch
            teamId={side.teamId}
            onSelect={addPlayer}
            existingIds={side.players.map((p) => p.playerId)}
          />
        )}

        {/* Added players */}
        {side.players.length > 0 && (
          <div className="space-y-2">
            <span className="text-data-xs uppercase tracking-wider text-text-muted">
              Players ({side.players.length})
            </span>
            {side.players.map((p) => (
              <TradePlayerCard
                key={p.playerId}
                player={p}
                onRemove={() => removePlayer(p.playerId)}
                onRetainedChange={(pct) =>
                  updateRetained(p.playerId, pct)
                }
              />
            ))}
          </div>
        )}

        {/* Draft picks */}
        <DraftPickSection
          picks={side.draftPicks}
          onAdd={addDraftPick}
          onRemove={removeDraftPick}
          disabled={!side.teamId}
        />

        {/* Empty state */}
        {side.players.length === 0 && side.draftPicks.length === 0 && (
          <p className="py-6 text-center text-data-xs text-text-muted">
            {side.teamId
              ? "Search for players to add to this side"
              : "Select a team to begin"}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Player Search Autocomplete ──

function PlayerSearch({
  teamId,
  onSelect,
  existingIds,
}: {
  teamId: string;
  onSelect: (p: SearchResult) => void;
  existingIds: string[];
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: results } = trpc.trade.searchPlayers.useQuery(
    { query: debouncedQuery, teamId },
    { enabled: debouncedQuery.length >= 2 },
  );

  const filtered = results?.filter(
    (r) => !existingIds.includes(r.playerId),
  );

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search players…"
          className="w-full rounded border border-border-subtle bg-surface-2 py-1.5 pl-8 pr-3 text-data-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
        />
      </div>

      {open && filtered && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded border border-border-subtle bg-surface-1 shadow-lg">
          {filtered.map((r) => (
            <button
              key={r.playerId}
              onClick={() => {
                onSelect(r);
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-2"
            >
              <TeamLogo teamAbbrev={r.teamAbbreviation} size="sm" />
              <div className="min-w-0 flex-1">
                <span className="text-data-sm font-medium text-text-primary">
                  {r.playerName}
                </span>
                <span className="ml-1.5 text-data-xs text-text-muted">
                  {r.position} · {r.teamAbbreviation}
                </span>
              </div>
              <span className="font-mono text-data-xs text-text-muted">
                {fmtCap(r.aav)}
              </span>
              {r.valueScore != null && (
                <span
                  className="font-mono text-data-xs font-semibold"
                  style={{ color: getScoreColor(r.valueScore) }}
                >
                  {r.valueScore}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Trade Player Card ──

function TradePlayerCard({
  player,
  onRemove,
  onRetainedChange,
}: {
  player: TradePlayer;
  onRemove: () => void;
  onRetainedChange: (pct: number) => void;
}) {
  const effectiveAAV = player.aav * (1 - player.retainedPct / 100);

  return (
    <div className="rounded border border-border-subtle bg-surface-2 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-data-sm font-medium text-text-primary">
              {player.playerName}
            </span>
            <span className="shrink-0 text-data-xs text-text-muted">
              {player.position}
            </span>
            {player.valueScore != null && (
              <ValueBadge score={player.valueScore} size="sm" />
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-data-xs text-text-muted">
            <span className="font-mono">{fmtCap(effectiveAAV)}</span>
            <span>·</span>
            <span>{player.yearsRemaining} yr rem</span>
            <span>·</span>
            <span>Age {player.age}</span>
            {player.hasNMC && (
              <span className="rounded bg-danger-muted px-1 py-0.5 text-danger">
                NMC
              </span>
            )}
            {player.hasNTC && (
              <span className="rounded bg-warning-muted px-1 py-0.5 text-warning">
                NTC
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="shrink-0 rounded p-0.5 text-text-muted transition-colors hover:bg-surface-3 hover:text-danger"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Retained salary slider */}
      <div className="mt-2 flex items-center gap-2">
        <span className="w-20 text-data-xs text-text-muted">Retained</span>
        <input
          type="range"
          min={0}
          max={50}
          step={5}
          value={player.retainedPct}
          onChange={(e) => onRetainedChange(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-surface-3 accent-accent"
        />
        <span className="w-10 text-right font-mono text-data-xs text-text-secondary">
          {player.retainedPct}%
        </span>
      </div>
      {player.retainedPct > 0 && (
        <p className="mt-0.5 text-data-xs text-text-muted">
          Dead cap: {fmtCap(player.aav * (player.retainedPct / 100))} retained
        </p>
      )}
    </div>
  );
}

// ── Draft Pick Section ──

function DraftPickSection({
  picks,
  onAdd,
  onRemove,
  disabled,
}: {
  picks: DraftPick[];
  onAdd: (year: number, round: number) => void;
  onRemove: (id: string) => void;
  disabled: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [year, setYear] = useState(2026);
  const [round, setRound] = useState(1);

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-data-xs uppercase tracking-wider text-text-muted">
          Draft Picks ({picks.length})
        </span>
        <button
          onClick={() => setAddOpen(!addOpen)}
          disabled={disabled}
          className={cn(
            "flex items-center gap-1 rounded px-2 py-0.5 text-data-xs transition-colors",
            disabled
              ? "text-text-muted cursor-not-allowed"
              : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
          )}
        >
          <Plus className="h-3 w-3" />
          Add Pick
        </button>
      </div>

      {addOpen && (
        <div className="mt-2 flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded border border-border-subtle bg-surface-2 px-2 py-1 text-data-xs text-text-primary outline-none"
          >
            {[2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            value={round}
            onChange={(e) => setRound(Number(e.target.value))}
            className="rounded border border-border-subtle bg-surface-2 px-2 py-1 text-data-xs text-text-primary outline-none"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((r) => (
              <option key={r} value={r}>
                Round {r}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              onAdd(year, round);
              setAddOpen(false);
            }}
            className="rounded bg-accent px-2.5 py-1 text-data-xs font-medium text-white hover:bg-accent-hover"
          >
            Add
          </button>
        </div>
      )}

      {picks.length > 0 && (
        <div className="mt-2 space-y-1">
          {picks.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded bg-surface-2 px-2.5 py-1.5"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3 text-text-muted" />
                <span className="text-data-sm text-text-secondary">
                  {p.year} Round {p.round}
                </span>
                <span className="font-mono text-data-xs text-text-muted">
                  ~{fmtCap(draftPickValue(p.round, p.year))}
                </span>
              </div>
              <button
                onClick={() => onRemove(p.id)}
                className="rounded p-0.5 text-text-muted transition-colors hover:text-danger"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Analysis Panel
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AnalysisPanel({
  sideA,
  sideB,
}: {
  sideA: TradeSide;
  sideB: TradeSide;
}) {
  const analysis = useMemo(
    () => computeAnalysis(sideA, sideB),
    [sideA, sideB],
  );

  const { data: teams } = trpc.trade.getTeams.useQuery();
  const teamAName =
    teams?.find((t) => t.id === sideA.teamId)?.abbreviation ?? "Team A";
  const teamBName =
    teams?.find((t) => t.id === sideB.teamId)?.abbreviation ?? "Team B";

  // Fetch cap info for both teams
  const { data: capA } = trpc.trade.getTeamCap.useQuery(
    { teamId: sideA.teamId! },
    { enabled: !!sideA.teamId },
  );
  const { data: capB } = trpc.trade.getTeamCap.useQuery(
    { teamId: sideB.teamId! },
    { enabled: !!sideB.teamId },
  );

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-medium text-text-primary">
        <FileText className="h-4 w-4 text-text-muted" />
        Trade Analysis
      </h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 1. Value Score Differential */}
        <Card title="Value Score Differential">
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-data-xs text-text-muted">{teamAName} gets</p>
              <p className="font-mono text-xl font-bold text-text-primary">
                {analysis.teamAGains.toFixed(0)}
              </p>
              <p className="text-data-xs text-text-muted">value points</p>
            </div>
            <div className="text-center">
              {analysis.valueDiff > 0 ? (
                <TrendingUp className="mx-auto h-5 w-5 text-success" />
              ) : analysis.valueDiff < 0 ? (
                <TrendingDown className="mx-auto h-5 w-5 text-danger" />
              ) : (
                <ArrowLeftRight className="mx-auto h-5 w-5 text-text-muted" />
              )}
              <p
                className={cn(
                  "font-mono text-data-sm font-bold",
                  analysis.valueDiff > 0
                    ? "text-success"
                    : analysis.valueDiff < 0
                      ? "text-danger"
                      : "text-text-muted",
                )}
              >
                {analysis.valueDiff > 0 ? "+" : ""}
                {analysis.valueDiff.toFixed(0)}
              </p>
              <p className="text-data-xs text-text-muted">
                {analysis.winner} wins
              </p>
            </div>
            <div className="text-center">
              <p className="text-data-xs text-text-muted">{teamBName} gets</p>
              <p className="font-mono text-xl font-bold text-text-primary">
                {analysis.teamBGains.toFixed(0)}
              </p>
              <p className="text-data-xs text-text-muted">value points</p>
            </div>
          </div>
        </Card>

        {/* 2. Cap Impact */}
        <Card title="Cap Impact Analysis">
          <div className="space-y-3">
            <CapRow
              label={teamAName}
              capChange={analysis.capA.change}
              currentSpace={capA?.capSpace ?? null}
              canFit={
                capA ? capA.capSpace + analysis.capA.change >= 0 : true
              }
            />
            <CapRow
              label={teamBName}
              capChange={analysis.capB.change}
              currentSpace={capB?.capSpace ?? null}
              canFit={
                capB ? capB.capSpace + analysis.capB.change >= 0 : true
              }
            />
            {analysis.deadCapA > 0 && (
              <p className="text-data-xs text-warning">
                ⚠ {teamAName} retains {fmtCap(analysis.deadCapA)} in dead cap
              </p>
            )}
            {analysis.deadCapB > 0 && (
              <p className="text-data-xs text-warning">
                ⚠ {teamBName} retains {fmtCap(analysis.deadCapB)} in dead cap
              </p>
            )}
          </div>
        </Card>

        {/* 3. Trade Protection Alerts */}
        {analysis.protectionAlerts.length > 0 && (
          <Card title="Trade Protection Alerts" icon={ShieldAlert}>
            <div className="space-y-2">
              {analysis.protectionAlerts.map((a, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2 rounded px-2.5 py-1.5",
                    a.type === "NMC"
                      ? "bg-danger-muted"
                      : "bg-warning-muted",
                  )}
                >
                  <AlertTriangle
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      a.type === "NMC" ? "text-danger" : "text-warning",
                    )}
                  />
                  <span
                    className={cn(
                      "text-data-sm",
                      a.type === "NMC" ? "text-danger" : "text-warning",
                    )}
                  >
                    <strong>{a.playerName}</strong> has a{" "}
                    {a.type === "NMC"
                      ? "No-Movement Clause — must waive to complete trade"
                      : "No-Trade Clause — may block this trade destination"}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 4. Age & Window Analysis */}
        <Card title="Age & Window Analysis">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-data-xs text-text-muted">
                {teamAName} acquires
              </p>
              <p className="mt-0.5 font-mono text-data-base font-semibold text-text-primary">
                Avg age {analysis.ageA.avgAge.toFixed(1)}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-data-xs font-medium",
                  analysis.ageA.window === "Win Now"
                    ? "text-accent"
                    : analysis.ageA.window === "Building"
                      ? "text-success"
                      : "text-info",
                )}
              >
                {analysis.ageA.window}
              </p>
            </div>
            <div>
              <p className="text-data-xs text-text-muted">
                {teamBName} acquires
              </p>
              <p className="mt-0.5 font-mono text-data-base font-semibold text-text-primary">
                Avg age {analysis.ageB.avgAge.toFixed(1)}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-data-xs font-medium",
                  analysis.ageB.window === "Win Now"
                    ? "text-accent"
                    : analysis.ageB.window === "Building"
                      ? "text-success"
                      : "text-info",
                )}
              >
                {analysis.ageB.window}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* 5. GM Summary */}
      <Card title="GM Summary" icon={FileText}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-data-xs font-medium uppercase tracking-wider text-accent">
              {teamAName}
            </p>
            <p className="text-data-sm leading-relaxed text-text-secondary">
              {generateGMSummary(
                teamAName,
                sideB.players,
                sideA.players,
                sideB.draftPicks,
                sideA.draftPicks,
                analysis.capA.change,
                analysis.valueDiff,
              )}
            </p>
          </div>
          <div>
            <p className="mb-1 text-data-xs font-medium uppercase tracking-wider text-info">
              {teamBName}
            </p>
            <p className="text-data-sm leading-relaxed text-text-secondary">
              {generateGMSummary(
                teamBName,
                sideA.players,
                sideB.players,
                sideA.draftPicks,
                sideB.draftPicks,
                analysis.capB.change,
                -analysis.valueDiff,
              )}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function CapRow({
  label,
  capChange,
  currentSpace,
  canFit,
}: {
  label: string;
  capChange: number;
  currentSpace: number | null;
  canFit: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-data-sm text-text-secondary">{label}</span>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "font-mono text-data-sm font-semibold",
            capChange > 0
              ? "text-danger"
              : capChange < 0
                ? "text-success"
                : "text-text-muted",
          )}
        >
          {capChange > 0 ? "+" : ""}
          {fmtCap(capChange)}
        </span>
        {currentSpace != null && (
          <span className="text-data-xs text-text-muted">
            ({fmtCap(currentSpace + capChange)} space)
          </span>
        )}
        {!canFit && (
          <span className="rounded bg-danger-muted px-1.5 py-0.5 text-data-xs font-medium text-danger">
            Over Cap
          </span>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Suggested Trades
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SuggestedTrades({
  teamId,
  onApply,
}: {
  teamId: string;
  onApply: (suggestion: RouterOutput["trade"]["getSuggestedTrades"]["suggestions"][number]) => void;
}) {
  const { data, isLoading } = trpc.trade.getSuggestedTrades.useQuery({
    teamId,
  });

  if (isLoading) {
    return (
      <Card title="Suggested Trades" icon={Lightbulb}>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded bg-surface-2"
            />
          ))}
        </div>
      </Card>
    );
  }

  if (!data || data.suggestions.length === 0) {
    return (
      <Card title="Suggested Trades" icon={Lightbulb}>
        <p className="py-6 text-center text-data-sm text-text-muted">
          No trade suggestions available. Your roster may already be
          well-balanced.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Suggested Trades"
      subtitle={`Based on position needs: ${data.positionNeeds.join(", ")} (avg scores: ${Object.entries(data.positionAverages).map(([k, v]) => `${k}: ${v}`).join(", ")})`}
      icon={Lightbulb}
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {data.suggestions.map((s) => (
          <div
            key={s.id}
            className="rounded border border-border-subtle bg-surface-2 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-data-sm font-medium text-text-primary">
                {s.title}
              </h4>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 font-mono text-data-xs font-semibold",
                  s.netValueChange > 0
                    ? "bg-success-muted text-success"
                    : "bg-danger-muted text-danger",
                )}
              >
                {s.netValueChange > 0 ? "+" : ""}
                {s.netValueChange}
              </span>
            </div>
            <p className="mt-1 text-data-xs leading-snug text-text-muted">
              {s.description}
            </p>
            <div className="mt-2 flex items-center justify-between border-t border-border-subtle pt-2">
              <div className="text-data-xs text-text-muted">
                <span className="text-accent">Give: </span>
                {s.teamAGives.map((p) => p.playerName).join(", ")}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-data-xs text-text-muted">
                <span className="text-success">Get: </span>
                {s.teamBGives.map((p) => p.playerName).join(", ")}
              </div>
            </div>
            <button
              onClick={() => onApply(s)}
              className="mt-2 w-full rounded bg-surface-3 py-1.5 text-data-xs font-medium text-text-secondary transition-colors hover:bg-accent hover:text-white"
            >
              Load into Analyzer
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Save Trade Modal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function SaveTradeModal({
  sideA,
  sideB,
  onClose,
}: {
  sideA: TradeSide;
  sideB: TradeSide;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const { data: teams } = trpc.trade.getTeams.useQuery();
  const teamAName =
    teams?.find((t) => t.id === sideA.teamId)?.abbreviation ?? "Team A";
  const teamBName =
    teams?.find((t) => t.id === sideB.teamId)?.abbreviation ?? "Team B";

  const saveMutation = trpc.trade.saveTrade.useMutation({
    onSuccess: () => {
      toast({ variant: "success", title: "Trade saved", description: "Trade scenario saved successfully." });
      onClose();
    },
  });

  const handleSave = () => {
    if (!name.trim()) return;

    const analysis = computeAnalysis(sideA, sideB);

    saveMutation.mutate({
      name: name.trim(),
      description: `${teamAName} ↔ ${teamBName}`,
      teams: {
        teamA: { id: sideA.teamId, name: teamAName },
        teamB: { id: sideB.teamId, name: teamBName },
      },
      playersInvolved: [
        ...sideA.players.map((p) => ({
          ...p,
          side: "A",
        })),
        ...sideB.players.map((p) => ({
          ...p,
          side: "B",
        })),
      ],
      draftPicks: [
        ...sideA.draftPicks.map((p) => ({ ...p, side: "A" })),
        ...sideB.draftPicks.map((p) => ({ ...p, side: "B" })),
      ],
      capImpact: {
        teamACapChange: analysis.capA.change,
        teamBCapChange: analysis.capB.change,
        valueDiff: analysis.valueDiff,
      },
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-label="Save trade scenario" className="w-full max-w-md rounded-md border border-border-subtle bg-surface-1 p-5">
        <h3 className="text-sm font-medium text-text-primary">
          Save Trade Scenario
        </h3>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-data-xs text-text-muted">
              Trade Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${teamAName} ↔ ${teamBName} Trade`}
              className="w-full rounded border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-data-xs text-text-muted">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-border-subtle px-4 py-1.5 text-data-sm text-text-secondary transition-colors hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saveMutation.isPending}
            className={cn(
              "rounded px-4 py-1.5 text-data-sm font-medium transition-colors",
              name.trim()
                ? "bg-accent text-white hover:bg-accent-hover"
                : "bg-surface-2 text-text-muted cursor-not-allowed",
            )}
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shared UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function Card({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-1">
      <div className="border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-text-muted" />}
          <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        </div>
        {subtitle && (
          <p className="mt-0.5 text-data-xs text-text-muted">{subtitle}</p>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Analysis computation (client-side)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function computeAnalysis(sideA: TradeSide, sideB: TradeSide) {
  // Team A gives sideA.players, receives sideB.players
  // Team B gives sideB.players, receives sideA.players

  // Value scores
  const aPlayersValue = sideA.players.reduce(
    (s, p) => s + (p.valueScore ?? 0),
    0,
  );
  const bPlayersValue = sideB.players.reduce(
    (s, p) => s + (p.valueScore ?? 0),
    0,
  );
  const aPicksValue = sideA.draftPicks.reduce(
    (s, p) => s + draftPickScoreValue(p.round),
    0,
  );
  const bPicksValue = sideB.draftPicks.reduce(
    (s, p) => s + draftPickScoreValue(p.round),
    0,
  );

  const teamAGains = bPlayersValue + bPicksValue;
  const teamALoses = aPlayersValue + aPicksValue;
  const valueDiff = teamAGains - teamALoses;
  const teamBGains = aPlayersValue + aPicksValue;

  const winner =
    Math.abs(valueDiff) < 3
      ? "Even"
      : valueDiff > 0
        ? "Team A"
        : "Team B";

  // Cap impact
  const aCapOut = sideA.players.reduce(
    (s, p) => s + p.aav * (1 - p.retainedPct / 100),
    0,
  );
  const bCapOut = sideB.players.reduce(
    (s, p) => s + p.aav * (1 - p.retainedPct / 100),
    0,
  );
  const deadCapA = sideA.players.reduce(
    (s, p) => s + p.aav * (p.retainedPct / 100),
    0,
  );
  const deadCapB = sideB.players.reduce(
    (s, p) => s + p.aav * (p.retainedPct / 100),
    0,
  );

  // Team A: loses aCapOut, gains bCapOut → net change = bCapOut - aCapOut + deadCapA
  const capAChange = bCapOut - aCapOut + deadCapA;
  const capBChange = aCapOut - bCapOut + deadCapB;

  // Trade protection
  const protectionAlerts: Array<{
    playerName: string;
    side: string;
    type: "NTC" | "NMC";
  }> = [];
  for (const p of sideA.players) {
    if (p.hasNMC)
      protectionAlerts.push({
        playerName: p.playerName,
        side: "A",
        type: "NMC",
      });
    else if (p.hasNTC)
      protectionAlerts.push({
        playerName: p.playerName,
        side: "A",
        type: "NTC",
      });
  }
  for (const p of sideB.players) {
    if (p.hasNMC)
      protectionAlerts.push({
        playerName: p.playerName,
        side: "B",
        type: "NMC",
      });
    else if (p.hasNTC)
      protectionAlerts.push({
        playerName: p.playerName,
        side: "B",
        type: "NTC",
      });
  }

  // Age analysis
  const teamAReceives = sideB.players;
  const teamBReceives = sideA.players;

  const avgAgeA =
    teamAReceives.length > 0
      ? teamAReceives.reduce((s, p) => s + p.age, 0) / teamAReceives.length
      : 0;
  const avgAgeB =
    teamBReceives.length > 0
      ? teamBReceives.reduce((s, p) => s + p.age, 0) / teamBReceives.length
      : 0;

  const windowA = getWindowAssessment(avgAgeA);
  const windowB = getWindowAssessment(avgAgeB);

  return {
    teamAGains,
    teamBGains,
    valueDiff,
    winner,
    capA: { change: capAChange },
    capB: { change: capBChange },
    deadCapA,
    deadCapB,
    protectionAlerts,
    ageA: { avgAge: avgAgeA, window: windowA },
    ageB: { avgAge: avgAgeB, window: windowB },
  };
}

function getWindowAssessment(avgAge: number): string {
  if (avgAge === 0) return "—";
  if (avgAge <= 24) return "Building";
  if (avgAge <= 27) return "Emerging";
  if (avgAge <= 30) return "Win Now";
  return "Veteran Acquisition";
}

function draftPickValue(round: number, year: number): number {
  const base: Record<number, number> = {
    1: 4_000_000,
    2: 2_000_000,
    3: 1_000_000,
    4: 500_000,
    5: 300_000,
    6: 200_000,
    7: 100_000,
  };
  const yearsOut = Math.max(0, year - 2026);
  const discount = Math.max(0.6, 1 - yearsOut * 0.1);
  return (base[round] ?? 100_000) * discount;
}

function draftPickScoreValue(round: number): number {
  const values: Record<number, number> = {
    1: 25,
    2: 15,
    3: 8,
    4: 5,
    5: 3,
    6: 2,
    7: 1,
  };
  return values[round] ?? 1;
}

function generateGMSummary(
  teamName: string,
  playersGained: TradePlayer[],
  playersLost: TradePlayer[],
  picksGained: DraftPick[],
  picksLost: DraftPick[],
  capChange: number,
  valueDiff: number,
): string {
  if (playersGained.length === 0 && playersLost.length === 0) {
    return "Add players to both sides to see the analysis.";
  }

  const parts: string[] = [];

  // What they gain
  if (playersGained.length > 0) {
    const names = playersGained.map((p) => p.playerName).join(", ");
    parts.push(`${teamName} acquires ${names}`);
  }
  if (picksGained.length > 0) {
    const picks = picksGained
      .map((p) => `${p.year} Rd ${p.round}`)
      .join(", ");
    parts.push(
      `${playersGained.length > 0 ? "along with" : "acquires"} draft picks (${picks})`,
    );
  }

  // What they lose
  if (playersLost.length > 0) {
    const names = playersLost.map((p) => p.playerName).join(", ");
    parts.push(`in exchange for ${names}`);
  }
  if (picksLost.length > 0) {
    const picks = picksLost
      .map((p) => `${p.year} Rd ${p.round}`)
      .join(", ");
    parts.push(
      `${playersLost.length > 0 ? "and" : "in exchange for"} draft picks (${picks})`,
    );
  }

  let summary = parts.join(" ") + ".";

  // Cap impact
  if (capChange !== 0) {
    summary +=
      capChange > 0
        ? ` This adds ${fmtCap(Math.abs(capChange))} to their cap hit.`
        : ` This frees up ${fmtCap(Math.abs(capChange))} in cap space.`;
  }

  // Value assessment
  if (valueDiff > 5) {
    summary += ` The analytics favor this deal — a net gain of ${valueDiff.toFixed(0)} value points.`;
  } else if (valueDiff < -5) {
    summary += ` The analytics suggest this is an overpay — a net loss of ${Math.abs(valueDiff).toFixed(0)} value points.`;
  } else {
    summary += " The trade is roughly fair by value score.";
  }

  return summary;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI Trade Board
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AITradeBoard({ teamId }: { teamId: string }) {
  const router = useRouter();
  const aiRecs = trpc.ai.getTradeRecommendations.useMutation();

  const riskColors = {
    low: "bg-success-muted text-success",
    medium: "bg-warning-muted text-warning",
    high: "bg-danger-muted text-danger",
  };

  return (
    <div className="rounded-md border border-border-subtle bg-surface-1">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-medium text-text-primary">
            AI Trade Board
          </h3>
          <span className="rounded bg-accent-muted px-1.5 py-0.5 text-data-xs font-medium text-accent">
            AI
          </span>
        </div>
        <button
          onClick={() => aiRecs.mutate({ teamId })}
          disabled={aiRecs.isPending}
          className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-data-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {aiRecs.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Target className="h-3.5 w-3.5" />
          )}
          {aiRecs.isPending ? "Analyzing…" : "Find Trade Targets"}
        </button>
      </div>

      <div className="p-4">
        {aiRecs.isError && (
          <p className="text-data-sm text-danger">{aiRecs.error.message}</p>
        )}

        {aiRecs.data && (
          <div className="space-y-4">
            {/* Analysis */}
            <div className="rounded-md bg-surface-2 p-3">
              <p className="text-data-sm leading-relaxed text-text-secondary">
                {aiRecs.data.analysis}
              </p>
            </div>

            {/* Weaknesses */}
            <div className="flex flex-wrap gap-2">
              {aiRecs.data.weaknesses.map((w) => (
                <span
                  key={w}
                  className="rounded bg-danger-muted px-2 py-1 text-data-xs text-danger"
                >
                  {w}
                </span>
              ))}
            </div>

            {/* Recommendations */}
            <div className="space-y-2">
              {aiRecs.data.recommendations.map((rec, i) => (
                <button
                  key={rec.targetId || i}
                  onClick={() => {
                    if (rec.targetId)
                      router.push(`/players/${rec.targetId}`);
                  }}
                  className="group w-full rounded-md border border-border-subtle p-3 text-left transition-colors hover:bg-surface-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-muted font-mono text-data-xs font-bold text-accent">
                          {rec.priority}
                        </span>
                        <span className="text-data-sm font-medium text-text-primary group-hover:text-accent">
                          {rec.targetName}
                        </span>
                        <TeamLogo teamAbbrev={rec.teamAbbreviation} size="sm" />
                        <span className="text-data-xs text-text-muted">
                          {rec.position} · {rec.teamAbbreviation}
                        </span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-data-xs font-medium",
                            riskColors[rec.riskLevel],
                          )}
                        >
                          {rec.riskLevel} risk
                        </span>
                      </div>
                      <p className="mt-1 text-data-xs font-medium text-text-secondary">
                        {rec.headline}
                      </p>
                      <p className="mt-1 text-data-xs text-text-muted">
                        {rec.rationale}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-data-sm text-text-primary">
                        {fmtCap(rec.aav)}
                      </p>
                      <p className="font-mono text-data-xs text-text-muted">
                        {rec.yearsRemaining}yr · Score {rec.valueScore}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded bg-surface-2 px-3 py-2">
              <Sparkles className="h-3 w-3 text-accent" />
              <p className="text-data-xs text-text-muted">
                Recommendations generated by Claude AI based on roster analysis
                and available trade targets.
              </p>
            </div>
          </div>
        )}

        {!aiRecs.data && !aiRecs.isPending && !aiRecs.isError && (
          <p className="py-6 text-center text-data-sm text-text-muted">
            Click &quot;Find Trade Targets&quot; for AI-powered trade
            recommendations based on your roster&apos;s weaknesses.
          </p>
        )}

        {aiRecs.isPending && (
          <div className="flex items-center justify-center gap-2 py-10">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <span className="text-data-sm text-text-muted">
              Analyzing roster and scanning trade market…
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Formatting helpers ──

function getScoreColor(score: number): string {
  if (score >= 90) return "#10b981";
  if (score >= 75) return "#60a5fa";
  if (score >= 60) return "#fbbf24";
  if (score >= 40) return "#a78bfa";
  return "#ef4444";
}

function fmtCap(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${abs}`;
}
