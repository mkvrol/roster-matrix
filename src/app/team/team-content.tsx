"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { ValueBadge } from "@/components/ui/value-badge";
import { TeamLogo } from "@/components/ui/team-logo";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Shield,
  Loader2,
  Calendar,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  FileText,
  Award,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from "recharts";

type RouterOutput = inferRouterOutputs<AppRouter>;
type RosterPlayer = RouterOutput["team"]["getRoster"][number];

type Transaction = {
  id: string;
  type: string;
  description: string;
  playersInvolved: unknown;
  date: string;
};

type Injury = {
  id: string;
  type: string;
  description: string | null;
  date: Date;
  expectedReturn: Date | null;
  player: { id: string; fullName: string; position: string };
};

type DraftPickOwned = {
  id: string;
  year: number;
  round: number;
  condition: string | null;
  isOwn: boolean;
  originalTeamAbbrev: string;
};

type DraftPickTraded = {
  id: string;
  year: number;
  round: number;
  condition: string | null;
  isOwn: boolean;
  tradedToAbbrev: string;
};

type DraftPicksData = {
  owned: DraftPickOwned[];
  tradedAway: DraftPickTraded[];
};

type SkaterSortField = "fullName" | "position" | "age" | "aav" | "yearsRemaining" | "overallScore" | "gamesPlayed" | "goals" | "assists" | "points";
type GoalieSortField = "fullName" | "age" | "aav" | "yearsRemaining" | "overallScore" | "gamesPlayed" | "savePercentage" | "goalsAgainstAvg";
type SortDir = "asc" | "desc";

function fmtCap(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${abs}`;
}

function fmtDate(d: string | Date): string {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TX_COLORS: Record<string, { bg: string; text: string }> = {
  TRADE: { bg: "bg-info-muted", text: "text-info" },
  SIGNING: { bg: "bg-success-muted", text: "text-success" },
  WAIVER: { bg: "bg-warning-muted", text: "text-warning" },
  RECALL: { bg: "bg-purple-muted", text: "text-purple" },
};

const INJURY_COLORS: Record<string, { bg: string; text: string }> = {
  DAY_TO_DAY: { bg: "bg-warning-muted", text: "text-warning" },
  IR: { bg: "bg-orange-500/10", text: "text-orange-400" },
  LTIR: { bg: "bg-danger-muted", text: "text-danger" },
  OUT: { bg: "bg-surface-2", text: "text-text-muted" },
};

export function TeamPageContent({ initialAbbrev }: { initialAbbrev?: string }) {
  const router = useRouter();

  const { data: teams } = trpc.league.getTeams.useQuery(undefined, { staleTime: 60 * 60 * 1000 });
  const { data: userTeamId } = trpc.trade.getUserTeam.useQuery();

  const resolvedTeamId = useMemo(() => {
    if (!teams) return undefined;
    if (initialAbbrev) {
      const match = teams.find((t) => t.abbreviation === initialAbbrev);
      if (match) return match.id;
    }
    if (userTeamId) {
      const match = teams.find((t) => t.id === userTeamId);
      if (match) return match.id;
    }
    return teams[0]?.id;
  }, [teams, initialAbbrev, userTeamId]);

  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(undefined);
  const teamId = selectedTeamId ?? resolvedTeamId;

  const trackMutation = trpc.analytics.track.useMutation();
  useEffect(() => {
    if (teamId) {
      const team = teams?.find((t) => t.id === teamId);
      trackMutation.mutate({
        eventType: "TEAM_VIEW",
        metadata: { teamId, teamAbbrev: team?.abbreviation ?? null, teamName: team?.name ?? null },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const overview = trpc.team.getOverview.useQuery({ teamId: teamId! }, { enabled: !!teamId });
  const roster = trpc.team.getRoster.useQuery({ teamId: teamId! }, { enabled: !!teamId });
  const transactions = trpc.team.getTransactions.useQuery({ teamId: teamId! }, { enabled: !!teamId });
  const injuries = trpc.team.getInjuries.useQuery({ teamId: teamId! }, { enabled: !!teamId });
  const draftPicks = trpc.team.getDraftPicks.useQuery({ teamId: teamId! }, { enabled: !!teamId });
  const briefing = trpc.ai.generateBriefing.useMutation();

  const isLoading =
    !teamId ||
    overview.isLoading ||
    roster.isLoading ||
    transactions.isLoading ||
    injuries.isLoading ||
    draftPicks.isLoading;

  const handleTeamChange = (newTeamId: string) => {
    setSelectedTeamId(newTeamId);
    const team = teams?.find((t) => t.id === newTeamId);
    if (team) {
      router.push(`/team/${team.abbreviation}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }

  const ov = overview.data!;
  const rosterData = roster.data ?? [];
  const txData: Transaction[] = (transactions.data ?? []).slice(0, 10);
  const injuryData = injuries.data ?? [];
  const picksData = draftPicks.data;

  const forwards = rosterData.filter((p) => ["C", "LW", "RW"].includes(p.position));
  const defensemen = rosterData.filter((p) => p.position === "D");
  const goalies = rosterData.filter((p) => p.position === "G");

  const capBarData = [
    {
      name: "Cap",
      F: ov.cap.capByPosition.F,
      D: ov.cap.capByPosition.D,
      G: ov.cap.capByPosition.G,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <select
          value={teamId}
          onChange={(e) => handleTeamChange(e.target.value)}
          className="rounded border border-border-subtle bg-surface-2 px-3 py-1.5 text-data-sm text-text-primary outline-none focus:border-accent"
        >
          {teams?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.abbreviation} — {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <TeamLogo teamAbbrev={ov.abbreviation} size="lg" />
        <PageHeader
          title={ov.name}
          subtitle={`${ov.division} · ${ov.conference}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        {/* Left column: Cap Overview */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label="Total Cap Hit" value={fmtCap(ov.cap.totalCapHit)} />
            <StatCard
              label="Cap Space"
              value={fmtCap(ov.cap.capSpace)}
              valueClass={ov.cap.capSpace >= 0 ? "text-success" : "text-danger"}
            />
            <StatCard label="Active Contracts" value={String(ov.cap.activeContracts)} />
            <StatCard label="Expiring This Year" value={String(ov.cap.expiringThisYear)} />
            <StatCard label="Expiring Next Year" value={String(ov.cap.expiringNextYear)} />
            <StatCard label="Projected Next Year Cap" value={fmtCap(ov.cap.projectedCapNextYear)} />
          </div>

          <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
            <h3 className="text-sm font-semibold text-text-primary">Cap Breakdown by Position</h3>
            <div className="mt-3 h-16">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={capBarData} layout="vertical" barCategoryGap={0}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                  <XAxis type="number" hide domain={[0, Math.max(ov.cap.totalCapHit * 1.05, 95_000_000)]} />
                  <YAxis type="category" dataKey="name" hide />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: "4px" }}
                    labelStyle={{ color: "#aaa" }}
                    formatter={(value: number, name: string) => [fmtCap(value), name]}
                  />
                  <Bar dataKey="F" stackId="a" fill="#3b82f6" name="Forwards" />
                  <Bar dataKey="D" stackId="a" fill="#10b981" name="Defense" />
                  <Bar dataKey="G" stackId="a" fill="#f59e0b" name="Goalies" />
                  <ReferenceLine x={70_600_000} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1.5} />
                  <ReferenceLine x={95_500_000} stroke="#f97316" strokeDasharray="5 5" strokeWidth={1.5} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex gap-4 text-data-xs text-text-muted">
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#3b82f6]" />F: {fmtCap(ov.cap.capByPosition.F)}</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#10b981]" />D: {fmtCap(ov.cap.capByPosition.D)}</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#f59e0b]" />G: {fmtCap(ov.cap.capByPosition.G)}</span>
              <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-[#ef4444]" />Floor: $70.6M</span>
              <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-[#f97316]" />Cap: $95.5M</span>
            </div>
          </div>
        </div>

        {/* Right column: Team Briefing */}
        <div className="rounded-md border border-border-subtle bg-surface-1 flex flex-col">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-text-primary">Team Briefing</h3>
            </div>
            {briefing.data && (
              <div className="flex items-center gap-2">
                <span className="text-data-xs text-text-muted">
                  {new Date(briefing.data.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <button
                  onClick={() => briefing.mutate({ teamId: teamId! })}
                  disabled={briefing.isPending}
                  className="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-secondary"
                  aria-label="Regenerate briefing"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", briefing.isPending && "animate-spin")} />
                </button>
              </div>
            )}
          </div>

          {/* Briefing content area */}
          <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: "400px" }}>
            {briefing.isPending && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="mb-3 h-6 w-6 animate-spin text-accent" />
                <p className="text-data-sm text-text-muted">Generating intelligence report...</p>
              </div>
            )}

            {briefing.isError && (
              <div className="rounded-md border border-danger/30 bg-danger-muted px-4 py-3">
                <p className="text-data-sm text-danger">{briefing.error.message}</p>
              </div>
            )}

            {briefing.data && !briefing.isPending && (
              <div className="space-y-4">
                {/* Summary row */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded bg-surface-2 p-2 text-center">
                    <p className="text-data-xs text-text-muted">Roster</p>
                    <p className="font-mono text-sm font-semibold text-text-primary">{briefing.data.summary.rosterSize}</p>
                  </div>
                  <div className="rounded bg-surface-2 p-2 text-center">
                    <p className="text-data-xs text-text-muted">Outperformers</p>
                    <p className="font-mono text-sm font-semibold text-success">{briefing.data.summary.outperformers}</p>
                  </div>
                  <div className="rounded bg-surface-2 p-2 text-center">
                    <p className="text-data-xs text-text-muted">Underperformers</p>
                    <p className="font-mono text-sm font-semibold text-danger">{briefing.data.summary.underperformers}</p>
                  </div>
                </div>

                {/* Briefing text */}
                <div className="prose prose-invert prose-sm max-w-none">
                  <BriefingContent content={briefing.data.briefing} />
                </div>

                {/* AI disclaimer */}
                <div className="flex items-center gap-2 rounded bg-surface-2 px-3 py-2">
                  <Sparkles className="h-3 w-3 shrink-0 text-accent" />
                  <p className="text-[10px] text-text-muted">
                    Generated by Claude AI. Validate recommendations with your analytics team.
                  </p>
                </div>
              </div>
            )}

            {!briefing.data && !briefing.isPending && !briefing.isError && (
              <div className="flex flex-col items-center justify-center py-10">
                <Sparkles className="mb-3 h-8 w-8 text-text-muted" />
                <p className="mb-1 text-sm font-medium text-text-primary">AI Intelligence Report</p>
                <p className="mb-4 max-w-xs text-center text-data-xs text-text-muted">
                  Generate an executive briefing covering roster value, trade opportunities, and cap outlook.
                </p>
                <button
                  onClick={() => briefing.mutate({ teamId: teamId! })}
                  className="flex items-center gap-2 rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate Briefing
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <RosterGroup
        title="Forwards"
        players={forwards}
        groupCapHit={forwards.reduce((s, p) => s + (p.contract?.aav ?? 0), 0)}
        isGoalie={false}
        router={router}
      />
      <RosterGroup
        title="Defensemen"
        players={defensemen}
        groupCapHit={defensemen.reduce((s, p) => s + (p.contract?.aav ?? 0), 0)}
        isGoalie={false}
        router={router}
      />
      <RosterGroup
        title="Goalies"
        players={goalies}
        groupCapHit={goalies.reduce((s, p) => s + (p.contract?.aav ?? 0), 0)}
        isGoalie={true}
        router={router}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
          <div className="flex items-center gap-2 pb-3">
            <Calendar className="h-3.5 w-3.5 text-text-muted" />
            <h3 className="text-sm font-semibold text-text-primary">Recent Transactions</h3>
          </div>
          {txData.length === 0 ? (
            <p className="text-data-sm text-text-muted">No recent transactions</p>
          ) : (
            <div className="space-y-3">
              {txData.map((tx: Transaction) => {
                const colors = TX_COLORS[tx.type] ?? { bg: "bg-surface-2", text: "text-text-muted" };
                const isTrade = tx.type === "TRADE";
                return (
                  <div
                    key={tx.id}
                    className={cn(
                      "flex items-start gap-3 rounded px-1.5 py-1.5",
                      isTrade && "cursor-pointer transition-colors hover:bg-surface-2",
                    )}
                    onClick={isTrade ? () => router.push(`/trade-analyzer?gradeTradeId=${tx.id}`) : undefined}
                  >
                    <span className="mt-0.5 shrink-0 text-data-xs text-text-muted">{fmtDate(tx.date)}</span>
                    <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-data-xs font-medium", colors.bg, colors.text)}>
                      {tx.type}
                    </span>
                    <span className="min-w-0 flex-1 text-data-sm text-text-secondary">{tx.description}</span>
                    {isTrade && (
                      <span className="flex shrink-0 items-center gap-1 text-data-xs font-medium text-accent">
                        <Award className="h-3 w-3" />
                        Grade
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
          <div className="flex items-center gap-2 pb-3">
            <AlertTriangle className="h-3.5 w-3.5 text-text-muted" />
            <h3 className="text-sm font-semibold text-text-primary">Injuries</h3>
          </div>
          {injuryData.length === 0 ? (
            <p className="text-data-sm text-text-muted">No current injuries</p>
          ) : (
            <div className="space-y-3">
              {injuryData.map((inj) => {
                const colors = INJURY_COLORS[inj.type] ?? { bg: "bg-surface-2", text: "text-text-muted" };
                return (
                  <div key={inj.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/players/${inj.player.id}`)}
                        className="text-data-sm font-medium text-text-primary hover:text-accent"
                      >
                        {inj.player.fullName}
                      </button>
                      <span className="text-data-xs text-text-muted">{inj.player.position}</span>
                      <span className={cn("rounded px-1.5 py-0.5 text-data-xs font-medium", colors.bg, colors.text)}>
                        {inj.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {inj.description && (
                        <span className="text-data-xs text-text-muted">{inj.description}</span>
                      )}
                      <span className="text-data-xs text-text-muted">
                        {inj.expectedReturn ? `Return: ${fmtDate(inj.expectedReturn)}` : "Season-ending"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {picksData && <DraftPickGrid data={picksData} />}
    </div>
  );
}

function StatCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
      <p className="text-data-xs text-text-muted">{label}</p>
      <p className={cn("mt-1 font-mono text-lg font-semibold text-text-primary", valueClass)}>{value}</p>
    </div>
  );
}

function RosterGroup({
  title,
  players,
  groupCapHit,
  isGoalie,
  router,
}: {
  title: string;
  players: RosterPlayer[];
  groupCapHit: number;
  isGoalie: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const [sortField, setSortField] = useState<string>("points");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    const arr = [...players];
    arr.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case "fullName":
          aVal = a.fullName;
          bVal = b.fullName;
          break;
        case "position":
          aVal = a.position;
          bVal = b.position;
          break;
        case "age":
          aVal = a.age;
          bVal = b.age;
          break;
        case "aav":
          aVal = a.contract?.aav ?? 0;
          bVal = b.contract?.aav ?? 0;
          break;
        case "yearsRemaining":
          aVal = a.yearsRemaining;
          bVal = b.yearsRemaining;
          break;
        case "overallScore":
          aVal = a.value?.overallScore ?? 0;
          bVal = b.value?.overallScore ?? 0;
          break;
        case "gamesPlayed":
          aVal = isGoalie ? (a.goalieStats?.gamesPlayed ?? 0) : (a.stats?.gamesPlayed ?? 0);
          bVal = isGoalie ? (b.goalieStats?.gamesPlayed ?? 0) : (b.stats?.gamesPlayed ?? 0);
          break;
        case "goals":
          aVal = a.stats?.goals ?? 0;
          bVal = b.stats?.goals ?? 0;
          break;
        case "assists":
          aVal = a.stats?.assists ?? 0;
          bVal = b.stats?.assists ?? 0;
          break;
        case "points":
          aVal = a.stats?.points ?? 0;
          bVal = b.stats?.points ?? 0;
          break;
        case "savePercentage":
          aVal = a.goalieStats?.savePercentage ?? 0;
          bVal = b.goalieStats?.savePercentage ?? 0;
          break;
        case "goalsAgainstAvg":
          aVal = a.goalieStats?.goalsAgainstAvg ?? 0;
          bVal = b.goalieStats?.goalsAgainstAvg ?? 0;
          break;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return arr;
  }, [players, sortField, sortDir, isGoalie]);

  const SortHeader = ({ field, label, align }: { field: string; label: string; align?: "left" | "right" }) => (
    <th
      className={cn(
        "cursor-pointer select-none px-3 py-2.5 text-data-xs font-medium uppercase tracking-wider text-text-muted transition-colors hover:text-text-secondary",
        align === "right" ? "text-right" : "text-left",
      )}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field ? (
          sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  );

  return (
    <div className="rounded-md border border-border-subtle bg-surface-1">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <span className="font-mono text-data-xs text-text-muted">{fmtCap(groupCapHit)}</span>
      </div>
      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-1">
              <SortHeader field="fullName" label="Player" />
              {!isGoalie && <SortHeader field="position" label="Pos" />}
              <SortHeader field="age" label="Age" align="right" />
              <SortHeader field="aav" label="AAV" align="right" />
              <SortHeader field="yearsRemaining" label="Term" align="right" />
              <SortHeader field="overallScore" label="Value" align="right" />
              <SortHeader field="gamesPlayed" label="GP" align="right" />
              {isGoalie ? (
                <>
                  <SortHeader field="savePercentage" label="SV%" align="right" />
                  <SortHeader field="goalsAgainstAvg" label="GAA" align="right" />
                </>
              ) : (
                <>
                  <SortHeader field="goals" label="G" align="right" />
                  <SortHeader field="assists" label="A" align="right" />
                  <SortHeader field="points" label="PTS" align="right" />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr
                key={p.id}
                onClick={() => router.push(`/players/${p.id}`)}
                className="cursor-pointer border-b border-border-subtle transition-colors last:border-b-0 even:bg-surface-0 hover:bg-surface-2"
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-data-sm font-medium text-text-primary">{p.fullName}</span>
                    {p.contract?.hasNMC && <Shield className="h-3 w-3 text-danger" />}
                    {p.contract?.hasNTC && <Shield className="h-3 w-3 text-warning" />}
                  </div>
                </td>
                {!isGoalie && (
                  <td className="px-3 py-2 font-mono text-data-sm text-text-secondary">{p.position}</td>
                )}
                <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">{p.age}</td>
                <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                  {p.contract ? fmtCap(p.contract.aav) : "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                  {p.yearsRemaining} yr
                </td>
                <td className="px-3 py-2 text-right">
                  {p.value ? <ValueBadge score={p.value.overallScore} size="sm" /> : <span className="text-data-xs text-text-muted">—</span>}
                </td>
                <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                  {isGoalie ? (p.goalieStats?.gamesPlayed ?? "—") : (p.stats?.gamesPlayed ?? "—")}
                </td>
                {isGoalie ? (
                  <>
                    <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                      {p.goalieStats?.savePercentage != null ? p.goalieStats.savePercentage.toFixed(3) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                      {p.goalieStats?.goalsAgainstAvg != null ? p.goalieStats.goalsAgainstAvg.toFixed(2) : "—"}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                      {p.stats?.goals ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                      {p.stats?.assists ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                      {p.stats?.points ?? "—"}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DraftPickGrid({ data }: { data: DraftPicksData }) {
  const years = [2025, 2026, 2027];
  const rounds = [1, 2, 3, 4, 5, 6, 7];

  const getCell = (round: number, year: number) => {
    const owned = data.owned.filter((p) => p.round === round && p.year === year);
    const lost = data.tradedAway.filter((p) => p.round === round && p.year === year);

    const items: React.ReactNode[] = [];

    for (const pick of owned) {
      if (pick.isOwn) {
        items.push(
          <span key={pick.id} className="text-data-xs font-medium text-success">
            OWN{pick.condition ? <span className="text-text-muted"> (cond.)</span> : null}
          </span>,
        );
      } else {
        items.push(
          <span key={pick.id} className="text-data-xs font-medium text-info">
            via {pick.originalTeamAbbrev}{pick.condition ? <span className="text-text-muted"> (cond.)</span> : null}
          </span>,
        );
      }
    }

    for (const pick of lost) {
      items.push(
        <span key={pick.id} className="text-data-xs text-text-muted">
          → {pick.tradedToAbbrev}{pick.condition ? <span> (cond.)</span> : null}
        </span>,
      );
    }

    if (items.length === 0) {
      return <span className="text-data-xs text-text-muted">—</span>;
    }

    return <div className="flex flex-col gap-0.5">{items}</div>;
  };

  return (
    <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
      <h3 className="pb-3 text-sm font-semibold text-text-primary">Draft Pick Summary</h3>
      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="px-3 py-2 text-left text-data-xs font-medium uppercase tracking-wider text-text-muted">Round</th>
              {years.map((y) => (
                <th key={y} className="px-3 py-2 text-center text-data-xs font-medium uppercase tracking-wider text-text-muted">{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => (
              <tr key={r} className="border-b border-border-subtle last:border-b-0 even:bg-surface-0">
                <td className="px-3 py-2 font-mono text-data-sm text-text-secondary">Rd {r}</td>
                {years.map((y) => (
                  <td key={y} className="px-3 py-2 text-center">{getCell(r, y)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BriefingContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) {
      elements.push(<br key={i} />);
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="mb-2 mt-6 text-base font-semibold text-text-primary first:mt-0">
          {trimmed.replace("## ", "")}
        </h2>,
      );
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="mb-3 mt-6 text-lg font-bold text-text-primary first:mt-0">
          {trimmed.replace("# ", "")}
        </h1>,
      );
    } else if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      elements.push(
        <p key={i} className="mt-4 font-semibold text-text-primary">
          {trimmed.replace(/\*\*/g, "")}
        </p>,
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      elements.push(
        <li key={i} className="ml-4 text-text-secondary">
          {formatInlineBold(trimmed.replace(/^[-•]\s*/, ""))}
        </li>,
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      elements.push(
        <li key={i} className="ml-4 list-decimal text-text-secondary">
          {formatInlineBold(trimmed.replace(/^\d+\.\s*/, ""))}
        </li>,
      );
    } else {
      elements.push(
        <p key={i} className="text-text-secondary leading-relaxed">
          {formatInlineBold(trimmed)}
        </p>,
      );
    }
  });

  return <>{elements}</>;
}

function formatInlineBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-text-primary">
          {part.replace(/\*\*/g, "")}
        </strong>
      );
    }
    return part;
  });
}
