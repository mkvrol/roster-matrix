"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { ValueBadge } from "@/components/ui/value-badge";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  TrendingUp,
  Calculator,
  Shield,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { usePageView } from "@/lib/use-track";

// ── Types ──

type RouterOutput = inferRouterOutputs<AppRouter>;
type ExpiringPlayer =
  RouterOutput["league"]["getExpiringBoard"]["expiringThisYear"][number];

type Tab = "database" | "expiring" | "trends" | "goalies";
type SortField =
  | "playerName"
  | "aav"
  | "yearsRemaining"
  | "overallScore"
  | "age"
  | "position";
type SortDir = "asc" | "desc";

const TABS: { id: Tab; label: string }[] = [
  { id: "database", label: "Contract Database" },
  { id: "expiring", label: "Expiring Contracts" },
  { id: "goalies", label: "Goalie Market" },
  { id: "trends", label: "Contract Trends" },
];

const POSITIONS = ["C", "LW", "RW", "D", "G"] as const;

// ── Main page ──

export default function ContractsPage() {
  usePageView("/contracts");
  const [activeTab, setActiveTab] = useState<Tab>("database");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contract Explorer"
        subtitle="League-wide contract database and analysis"
      />

      {/* Tab bar */}
      <div className="flex gap-1 rounded-md border border-border-subtle bg-surface-1 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 rounded px-3 py-2 text-data-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-surface-2 text-text-primary"
                : "text-text-muted hover:text-text-secondary",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div key={activeTab} className="animate-in fade-in duration-200">
        {activeTab === "database" && <DatabaseTab />}
        {activeTab === "expiring" && <ExpiringTab />}
        {activeTab === "goalies" && <GoalieMarketTab />}
        {activeTab === "trends" && <TrendsTab />}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 1: Contract Database
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DatabaseTab() {
  const router = useRouter();
  const { data: teams } = trpc.league.getTeams.useQuery(undefined, { staleTime: 60 * 60 * 1000 });

  // Filters
  const [position, setPosition] = useState<string | undefined>();
  const [teamId, setTeamId] = useState<string | undefined>();
  const [aavMin, setAavMin] = useState("");
  const [aavMax, setAavMax] = useState("");
  const [yearsRemaining, setYearsRemaining] = useState<string>("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [ntcFilter, setNtcFilter] = useState<string>("");
  const [signingType, setSigning] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Sort + page
  const [sortBy, setSortBy] = useState<SortField>("aav");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const queryInput = useMemo(() => {
    const input: Record<string, unknown> = {
      sortBy,
      sortDir,
      page,
      perPage,
    };
    if (position) input.position = position;
    if (teamId) input.teamId = teamId;
    if (aavMin) input.aavMin = Number(aavMin) * 1_000_000;
    if (aavMax) input.aavMax = Number(aavMax) * 1_000_000;
    if (yearsRemaining === "1")
      input.yearsRemainingMin = 0, input.yearsRemainingMax = 1;
    else if (yearsRemaining === "2")
      input.yearsRemainingMin = 2, input.yearsRemainingMax = 2;
    else if (yearsRemaining === "3")
      input.yearsRemainingMin = 3, input.yearsRemainingMax = 3;
    else if (yearsRemaining === "4+") input.yearsRemainingMin = 4;
    if (ageMin) input.ageMin = Number(ageMin);
    if (ageMax) input.ageMax = Number(ageMax);
    if (scoreMin) input.scoreMin = Number(scoreMin);
    if (scoreMax) input.scoreMax = Number(scoreMax);
    if (ntcFilter === "yes") input.hasNTC = true;
    if (ntcFilter === "no") input.hasNTC = false;
    if (signingType) input.signingType = signingType;
    if (statusFilter) input.contractStatus = statusFilter;
    return input;
  }, [
    position,
    teamId,
    aavMin,
    aavMax,
    yearsRemaining,
    ageMin,
    ageMax,
    scoreMin,
    scoreMax,
    ntcFilter,
    signingType,
    statusFilter,
    sortBy,
    sortDir,
    page,
    perPage,
  ]);

  const { data, isLoading } = trpc.league.getContracts.useQuery(
    queryInput as Parameters<typeof trpc.league.getContracts.useQuery>[0],
  );

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
    setPage(1);
  };

  const resetFilters = () => {
    setPosition(undefined);
    setTeamId(undefined);
    setAavMin("");
    setAavMax("");
    setYearsRemaining("");
    setAgeMin("");
    setAgeMax("");
    setScoreMin("");
    setScoreMax("");
    setNtcFilter("");
    setSigning("");
    setStatusFilter("");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Filter toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="flex items-center gap-1.5 rounded border border-border-subtle bg-surface-1 px-3 py-1.5 text-data-sm text-text-secondary transition-colors hover:bg-surface-2"
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
        </button>
        <button
          onClick={resetFilters}
          className="text-data-xs text-text-muted hover:text-text-secondary"
        >
          Clear all
        </button>
      </div>

      {/* Position filter bar (always visible) */}
      <PosFilter value={position} onChange={(v) => { setPosition(v); setPage(1); }} />

      {/* Collapsible filters */}
      {filtersOpen && (
        <div className="grid grid-cols-2 gap-3 rounded-md border border-border-subtle bg-surface-1 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <FilterSelect
            label="Team"
            value={teamId ?? ""}
            onChange={(v) => { setTeamId(v || undefined); setPage(1); }}
            options={[
              { value: "", label: "All Teams" },
              ...(teams?.map((t) => ({
                value: t.id,
                label: t.abbreviation,
              })) ?? []),
            ]}
          />
          <FilterInput
            label="Min AAV ($M)"
            value={aavMin}
            onChange={(v) => { setAavMin(v); setPage(1); }}
            placeholder="0"
          />
          <FilterInput
            label="Max AAV ($M)"
            value={aavMax}
            onChange={(v) => { setAavMax(v); setPage(1); }}
            placeholder="15"
          />
          <FilterSelect
            label="Years Left"
            value={yearsRemaining}
            onChange={(v) => { setYearsRemaining(v); setPage(1); }}
            options={[
              { value: "", label: "Any" },
              { value: "1", label: "≤ 1 year" },
              { value: "2", label: "2 years" },
              { value: "3", label: "3 years" },
              { value: "4+", label: "4+ years" },
            ]}
          />
          <FilterInput
            label="Min Age"
            value={ageMin}
            onChange={(v) => { setAgeMin(v); setPage(1); }}
            placeholder="18"
          />
          <FilterInput
            label="Max Age"
            value={ageMax}
            onChange={(v) => { setAgeMax(v); setPage(1); }}
            placeholder="40"
          />
          <FilterInput
            label="Min Score"
            value={scoreMin}
            onChange={(v) => { setScoreMin(v); setPage(1); }}
            placeholder="1"
          />
          <FilterInput
            label="Max Score"
            value={scoreMax}
            onChange={(v) => { setScoreMax(v); setPage(1); }}
            placeholder="99"
          />
          <FilterSelect
            label="NTC"
            value={ntcFilter}
            onChange={(v) => { setNtcFilter(v); setPage(1); }}
            options={[
              { value: "", label: "Any" },
              { value: "yes", label: "Has NTC" },
              { value: "no", label: "No NTC" },
            ]}
          />
          <FilterSelect
            label="Signing Type"
            value={signingType}
            onChange={(v) => { setSigning(v); setPage(1); }}
            options={[
              { value: "", label: "Any" },
              { value: "RFA", label: "RFA" },
              { value: "UFA", label: "UFA" },
              { value: "ELC", label: "ELC" },
              { value: "EXTENSION", label: "Extension" },
            ]}
          />
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={[
              { value: "", label: "Active + Future" },
              { value: "ACTIVE", label: "Active" },
              { value: "FUTURE", label: "Future" },
            ]}
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-auto rounded-md border border-border-subtle">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-1">
              <SortTh field="playerName" label="Player" active={sortBy} dir={sortDir} onClick={handleSort} />
              <SortTh field="position" label="POS" active={sortBy} dir={sortDir} onClick={handleSort} width="55px" />
              <SortTh field="age" label="Age" active={sortBy} dir={sortDir} onClick={handleSort} width="55px" align="right" />
              <SortTh field="aav" label="AAV" active={sortBy} dir={sortDir} onClick={handleSort} width="90px" align="right" />
              <SortTh field="yearsRemaining" label="Term" active={sortBy} dir={sortDir} onClick={handleSort} width="60px" align="right" />
              <SortTh field="overallScore" label="Value" active={sortBy} dir={sortDir} onClick={handleSort} width="120px" align="right" />
              <th className="px-3 py-2.5 text-left text-data-xs font-medium uppercase tracking-wider text-text-muted" style={{ width: "80px" }}>
                Status
              </th>
              <th className="px-3 py-2.5 text-left text-data-xs font-medium uppercase tracking-wider text-text-muted" style={{ width: "70px" }}>
                Type
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-border-subtle">
                  <td colSpan={8} className="px-3 py-2">
                    <div className="h-5 animate-pulse rounded bg-surface-2" />
                  </td>
                </tr>
              ))
            ) : data && data.rows.length > 0 ? (
              data.rows.map((row) => (
                <tr
                  key={row.contractId}
                  onClick={() => router.push(`/players/${row.playerId}`)}
                  className="cursor-pointer border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-2"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-data-sm font-medium text-text-primary">
                        {row.playerName}
                      </span>
                      {row.teamAbbreviation && (
                        <span className="text-data-xs text-text-muted">
                          {row.teamAbbreviation}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-data-sm text-text-secondary">
                    {row.position}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                    {row.age}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                    {fmtCap(row.aav)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                    {row.yearsRemaining} yr
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.overallScore != null ? (
                      <ValueBadge score={row.overallScore} size="sm" />
                    ) : (
                      <span className="text-data-xs text-text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {row.status === "FUTURE" && (
                        <span className="rounded bg-info-muted px-1 py-0.5 text-data-xs text-info">
                          FUTURE
                        </span>
                      )}
                      {row.hasNMC && (
                        <span className="rounded bg-danger-muted px-1 py-0.5 text-data-xs text-danger">
                          NMC
                        </span>
                      )}
                      {row.hasNTC && (
                        <span className="rounded bg-warning-muted px-1 py-0.5 text-data-xs text-warning">
                          NTC
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-data-xs text-text-muted">
                    {row.signingType ?? "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-10 text-center text-data-sm text-text-muted"
                >
                  No contracts match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-1 px-4 py-2.5">
          <span className="text-data-xs text-text-muted">
            Showing {(data.page - 1) * data.perPage + 1}–
            {Math.min(data.page * data.perPage, data.total)} of {data.total}
          </span>
          <div className="flex items-center gap-2">
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="rounded border border-border-subtle bg-surface-2 px-2 py-1 text-data-xs text-text-primary outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded p-1 text-text-muted transition-colors hover:bg-surface-2 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-mono text-data-xs text-text-secondary">
              {data.page} / {data.totalPages}
            </span>
            <button
              onClick={() =>
                setPage((p) => Math.min(data.totalPages, p + 1))
              }
              disabled={page >= data.totalPages}
              className="rounded p-1 text-text-muted transition-colors hover:bg-surface-2 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 2: Expiring Contracts Board
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ExpiringTab() {
  const [position, setPosition] = useState<
    "C" | "LW" | "RW" | "D" | "G" | undefined
  >();
  const { data, isLoading } = trpc.league.getExpiringBoard.useQuery({
    position,
  });

  return (
    <div className="space-y-4">
      <PosFilter
        value={position}
        onChange={(v) => setPosition(v as typeof position)}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-80 animate-pulse rounded-md border border-border-subtle bg-surface-1"
            />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <KanbanColumn
            title="Expiring This Year"
            accent="danger"
            players={data.expiringThisYear}
          />
          <KanbanColumn
            title="Expiring Next Year"
            accent="warning"
            players={data.expiringNextYear}
          />
          <KanbanColumn
            title="Extension Eligible"
            accent="info"
            players={data.extensionEligible}
          />
          <FutureContractsColumn players={data.futureContracts} />
        </div>
      ) : null}
    </div>
  );
}

function KanbanColumn({
  title,
  accent,
  players,
}: {
  title: string;
  accent: string;
  players: ExpiringPlayer[];
}) {
  const router = useRouter();

  return (
    <div
      className={cn(
        "rounded-md border border-border-subtle bg-surface-1",
        accent === "danger"
          ? "border-l-2 border-l-danger"
          : accent === "warning"
            ? "border-l-2 border-l-warning"
            : "border-l-2 border-l-info",
      )}
    >
      <div className="border-b border-border-subtle px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-primary">{title}</h3>
          <span className="font-mono text-data-xs text-text-muted">
            {players.length}
          </span>
        </div>
      </div>
      <div className="max-h-[500px] space-y-1 overflow-auto p-2">
        {players.length === 0 ? (
          <p className="py-6 text-center text-data-xs text-text-muted">
            No contracts
          </p>
        ) : (
          players.map((p) => (
            <button
              key={p.playerId}
              onClick={() => router.push(`/players/${p.playerId}`)}
              className="group flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
              style={{
                borderLeft: `2px solid ${p.overallScore != null ? getScoreColor(p.overallScore) : "#334155"}`,
              }}
            >
              <div className="min-w-0 flex-1">
                <span className="truncate text-data-sm font-medium text-text-primary group-hover:text-accent">
                  {p.playerName}
                </span>
                <div className="text-data-xs text-text-muted">
                  {p.position} · {p.teamAbbreviation} · Age {p.age}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-data-xs text-text-muted">
                    {fmtCap(p.aav)}
                  </span>
                  {p.overallScore != null && (
                    <span
                      className="font-mono text-data-sm font-semibold tabular-nums"
                      style={{ color: getScoreColor(p.overallScore) }}
                    >
                      {p.overallScore}
                    </span>
                  )}
                </div>
                {p.projectedAAV && (
                  <span className="font-mono text-data-xs text-info">
                    → {fmtCap(p.projectedAAV.mid)}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function FutureContractsColumn({
  players,
}: {
  players: Array<{
    playerId: string;
    playerName: string;
    position: string;
    teamAbbreviation: string | null;
    aav: number;
    startYear: number;
    endYear: number;
    totalYears: number;
    age: number;
  }>;
}) {
  const router = useRouter();
  return (
    <div className="rounded-md border border-border-subtle border-l-2 border-l-accent bg-surface-1">
      <div className="border-b border-border-subtle px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-primary">Future Contracts</h3>
          <span className="font-mono text-data-xs text-text-muted">{players.length}</span>
        </div>
      </div>
      <div className="max-h-[500px] space-y-1 overflow-auto p-2">
        {players.length === 0 ? (
          <p className="py-6 text-center text-data-xs text-text-muted">No future contracts</p>
        ) : (
          players.map((p) => (
            <button
              key={p.playerId}
              onClick={() => router.push(`/players/${p.playerId}`)}
              className="group flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-left transition-colors hover:bg-surface-2"
              style={{ borderLeft: "2px solid #60a5fa" }}
            >
              <div className="min-w-0 flex-1">
                <span className="truncate text-data-sm font-medium text-text-primary group-hover:text-accent">
                  {p.playerName}
                </span>
                <div className="text-data-xs text-text-muted">
                  {p.position} · {p.teamAbbreviation} · Age {p.age}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="font-mono text-data-sm font-semibold text-text-primary">
                  {fmtCap(p.aav)}
                </span>
                <span className="rounded bg-info-muted px-1 py-0.5 text-data-xs text-info">
                  Begins {p.startYear}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 3: Goalie Market
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function GoalieMarketTab() {
  const router = useRouter();
  const { data: teams } = trpc.league.getTeams.useQuery(undefined, { staleTime: 60 * 60 * 1000 });

  const [roleFilter, setRoleFilter] = useState<"all" | "starter" | "backup">("all");
  const [teamId, setTeamId] = useState<string | undefined>();
  const [sortBy, setSortBy] = useState<"savePercentage" | "goalsAboveExpected" | "aav" | "valueScore" | "gamesStarted">("valueScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: goalies = [], isLoading } = trpc.league.getGoalieMarket.useQuery({
    roleFilter,
    teamId,
    sortBy,
    sortDir,
  });

  const avgSvPct = goalies.length
    ? goalies.reduce((s, g) => s + (g.savePercentage ?? 0), 0) / goalies.length
    : 0;
  const avgAAV = goalies.length
    ? goalies.reduce((s, g) => s + (g.aav ?? 0), 0) / goalies.length
    : 0;
  const avgValue = goalies.length
    ? goalies.reduce((s, g) => s + (g.overallScore ?? 0), 0) / goalies.length
    : 0;

  function handleSort(field: string) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field as typeof sortBy);
      setSortDir("desc");
    }
  }

  function SortHeader({
    field,
    label,
    align = "left",
    width,
  }: {
    field: string;
    label: string;
    align?: "left" | "right";
    width?: string;
  }) {
    return (
      <th
        className={cn(
          "cursor-pointer select-none px-3 py-2.5 text-data-xs font-medium uppercase tracking-wider text-text-muted transition-colors hover:text-text-secondary",
          align === "right" ? "text-right" : "text-left",
        )}
        style={width ? { width } : undefined}
        onClick={() => handleSort(field)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {sortBy === field ? (
            sortDir === "asc" ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )
          ) : (
            <ChevronsUpDown className="h-3 w-3 opacity-30" />
          )}
        </span>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-data-xs text-text-muted">Role</label>
          <div className="flex gap-1">
            {([
              { value: "all", label: "All" },
              { value: "starter", label: "Starters" },
              { value: "backup", label: "Backups" },
            ] as const).map((r) => (
              <button
                key={r.value}
                onClick={() => setRoleFilter(r.value)}
                className={cn(
                  "rounded px-3 py-1.5 text-data-xs font-medium transition-colors",
                  roleFilter === r.value
                    ? "bg-accent text-white"
                    : "bg-surface-1 text-text-muted hover:bg-surface-2 hover:text-text-secondary",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <FilterSelect
          label="Team"
          value={teamId ?? ""}
          onChange={(v) => setTeamId(v || undefined)}
          options={[
            { value: "", label: "All Teams" },
            ...(teams?.map((t) => ({
              value: t.id,
              label: t.abbreviation,
            })) ?? []),
          ]}
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-border-subtle bg-surface-1 p-3">
          <div className="flex items-center gap-1.5 text-data-xs text-text-muted">
            <Shield className="h-3.5 w-3.5" />
            Total Goalies
          </div>
          <div className="mt-1 text-lg font-semibold text-text-primary">
            {goalies.length}
          </div>
        </div>
        <div className="rounded-md border border-border-subtle bg-surface-1 p-3">
          <div className="text-data-xs text-text-muted">Avg SV%</div>
          <div className="mt-1 text-lg font-semibold text-text-primary">
            {avgSvPct ? avgSvPct.toFixed(3) : "—"}
          </div>
        </div>
        <div className="rounded-md border border-border-subtle bg-surface-1 p-3">
          <div className="text-data-xs text-text-muted">Avg AAV</div>
          <div className="mt-1 text-lg font-semibold text-text-primary">
            {avgAAV ? fmtCap(avgAAV) : "—"}
          </div>
        </div>
        <div className="rounded-md border border-border-subtle bg-surface-1 p-3">
          <div className="text-data-xs text-text-muted">Avg Value Score</div>
          <div className="mt-1 text-lg font-semibold text-text-primary">
            {avgValue ? avgValue.toFixed(1) : "—"}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-md border border-border-subtle">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-1">
              <SortHeader field="playerName" label="Player" />
              <SortHeader field="role" label="Role" width="80px" />
              <SortHeader field="gamesPlayed" label="GP/GS" width="70px" align="right" />
              <SortHeader field="savePercentage" label="SV%" width="70px" align="right" />
              <SortHeader field="goalsAgainstAvg" label="GAA" width="65px" align="right" />
              <SortHeader field="goalsAboveExpected" label="GSAx" width="70px" align="right" />
              <SortHeader field="qualityStartPct" label="QS%" width="65px" align="right" />
              <SortHeader field="highDangerSavePct" label="HD SV%" width="80px" align="right" />
              <SortHeader field="aav" label="AAV" width="90px" align="right" />
              <SortHeader field="valueScore" label="Value" width="100px" align="right" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-border-subtle">
                  <td colSpan={10} className="px-3 py-2">
                    <div className="h-5 animate-pulse rounded bg-surface-2" />
                  </td>
                </tr>
              ))
            ) : goalies.length > 0 ? (
              goalies.map((g) => (
                <tr
                  key={g.playerId}
                  onClick={() => router.push(`/players/${g.playerId}`)}
                  className="cursor-pointer border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-2"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-data-sm font-medium text-text-primary">
                        {g.playerName}
                      </span>
                      {g.teamAbbreviation && (
                        <span className="text-data-xs text-text-muted">
                          {g.teamAbbreviation}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-data-xs font-medium",
                        g.role === "Starter"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-blue-500/15 text-blue-400",
                      )}
                    >
                      {g.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                    {g.gamesPlayed}/{g.gamesStarted}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                    {g.savePercentage != null ? g.savePercentage.toFixed(3) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                    {g.goalsAgainstAvg != null ? g.goalsAgainstAvg.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                    {g.goalsAboveExpected != null ? g.goalsAboveExpected.toFixed(1) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                    {g.qualityStartPct != null ? g.qualityStartPct.toFixed(1) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                    {g.highDangerSavePct != null ? g.highDangerSavePct.toFixed(3) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                    {g.aav != null ? fmtCap(g.aav) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {g.overallScore != null ? (
                      <ValueBadge score={g.overallScore} size="sm" />
                    ) : (
                      <span className="text-data-xs text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={10}
                  className="px-3 py-10 text-center text-data-sm text-text-muted"
                >
                  No goalies match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 4: Contract Trends
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function TrendsTab() {
  const { data: trends, isLoading } = trpc.league.getAAVTrends.useQuery();

  const capProjection = useMemo(() => {
    const base = 95_500_000;
    const rate = 1.035;
    return [
      { label: "2025–26", cap: base },
      { label: "2026–27", cap: Math.round(base * rate) },
      { label: "2027–28", cap: Math.round(base * rate * rate) },
      {
        label: "2028–29",
        cap: Math.round(base * rate * rate * rate),
      },
    ];
  }, []);

  return (
    <div className="space-y-6">
      {/* AAV by Position */}
      <Card title="Average AAV by Position" icon={TrendingUp}>
        {isLoading ? (
          <div className="h-72 animate-pulse rounded bg-surface-2" />
        ) : trends && trends.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart
              data={trends.map((t) => ({
                season: t.seasonLabel as string,
                C: (t.C as number) / 1_000_000,
                LW: (t.LW as number) / 1_000_000,
                RW: (t.RW as number) / 1_000_000,
                D: (t.D as number) / 1_000_000,
                G: (t.G as number) / 1_000_000,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="season"
                tick={{ fontSize: 10, fill: "#64748b" }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#64748b" }}
                label={{
                  value: "AAV ($M)",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 10, fill: "#64748b" },
                }}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #334155",
                  borderRadius: "0.375rem",
                  fontSize: "0.75rem",
                }}
                formatter={(value: number) => `$${value.toFixed(1)}M`}
              />
              <Legend wrapperStyle={{ fontSize: "0.7rem" }} />
              <Line type="monotone" dataKey="C" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} name="Center" />
              <Line type="monotone" dataKey="LW" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Left Wing" />
              <Line type="monotone" dataKey="RW" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} name="Right Wing" />
              <Line type="monotone" dataKey="D" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} name="Defense" />
              <Line type="monotone" dataKey="G" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} name="Goalie" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-10 text-center text-data-sm text-text-muted">
            Not enough historical data
          </p>
        )}
      </Card>

      {/* Cap Ceiling Projection */}
      <Card title="Salary Cap Projection (3.5% growth)">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={capProjection}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#64748b" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#64748b" }}
              domain={[80_000_000, 100_000_000]}
              tickFormatter={(v: number) => `$${(v / 1_000_000).toFixed(0)}M`}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #334155",
                borderRadius: "0.375rem",
                fontSize: "0.75rem",
              }}
              formatter={(value: number) => fmtCap(value)}
            />
            <Bar dataKey="cap" fill="#dc2626" radius={[4, 4, 0, 0]} name="Cap Ceiling" />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          {capProjection.map((c) => (
            <div key={c.label}>
              <p className="text-data-xs text-text-muted">{c.label}</p>
              <p className="font-mono text-data-sm font-semibold text-text-primary">
                {fmtCap(c.cap)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Market Value Calculator */}
      <MarketValueCalculator />
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Market Value Calculator
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function MarketValueCalculator() {
  const [position, setPosition] = useState<string>("C");
  const [age, setAge] = useState("27");
  const [gamesPlayed, setGamesPlayed] = useState("82");
  const [goals, setGoals] = useState("25");
  const [assists, setAssists] = useState("35");
  // Goalie inputs
  const [gamesStarted, setGamesStarted] = useState("55");
  const [savePercentage, setSavePercentage] = useState("0.915");

  const isGoalie = position === "G";

  const queryInput = useMemo(() => {
    const gp = Number(gamesPlayed) || 1;
    const a = Number(age) || 27;
    if (gp < 1 || a < 18 || a > 45) return null;

    const input: Record<string, unknown> = {
      position,
      age: a,
      gamesPlayed: gp,
    };

    if (isGoalie) {
      input.gamesStarted = Number(gamesStarted) || gp;
      input.savePercentage = Number(savePercentage) || 0.910;
    } else {
      input.goals = Number(goals) || 0;
      input.assists = Number(assists) || 0;
      input.points = (Number(goals) || 0) + (Number(assists) || 0);
    }

    return input;
  }, [position, age, gamesPlayed, goals, assists, gamesStarted, savePercentage, isGoalie]);

  const { data: result } = trpc.league.estimateMarketValue.useQuery(
    queryInput as Parameters<typeof trpc.league.estimateMarketValue.useQuery>[0],
    { enabled: queryInput !== null },
  );

  return (
    <Card
      title="Market Value Calculator"
      subtitle="Input a stat line to estimate fair market AAV"
      icon={Calculator}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className="mb-1 block text-data-xs text-text-muted">
            Position
          </label>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="w-full rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-data-sm text-text-primary outline-none focus:border-accent"
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-data-xs text-text-muted">
            Age
          </label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-data-sm text-text-primary outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-data-xs text-text-muted">
            GP
          </label>
          <input
            type="number"
            value={gamesPlayed}
            onChange={(e) => setGamesPlayed(e.target.value)}
            className="w-full rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-data-sm text-text-primary outline-none focus:border-accent"
          />
        </div>
        {isGoalie ? (
          <>
            <div>
              <label className="mb-1 block text-data-xs text-text-muted">
                GS
              </label>
              <input
                type="number"
                value={gamesStarted}
                onChange={(e) => setGamesStarted(e.target.value)}
                className="w-full rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-data-sm text-text-primary outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-data-xs text-text-muted">
                SV%
              </label>
              <input
                type="number"
                step="0.001"
                value={savePercentage}
                onChange={(e) => setSavePercentage(e.target.value)}
                className="w-full rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-data-sm text-text-primary outline-none focus:border-accent"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-data-xs text-text-muted">
                Goals
              </label>
              <input
                type="number"
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                className="w-full rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-data-sm text-text-primary outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-data-xs text-text-muted">
                Assists
              </label>
              <input
                type="number"
                value={assists}
                onChange={(e) => setAssists(e.target.value)}
                className="w-full rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-data-sm text-text-primary outline-none focus:border-accent"
              />
            </div>
          </>
        )}
      </div>

      {/* Result */}
      {result?.projectedAAV && (
        <div className="mt-4 rounded-md border border-border-subtle bg-surface-2 p-4">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-data-xs text-text-muted">Estimated AAV</p>
              <p className="font-mono text-xl font-bold text-accent">
                {fmtCap(result.projectedAAV.mid)}
              </p>
            </div>
            <div>
              <p className="text-data-xs text-text-muted">Range</p>
              <p className="font-mono text-data-sm text-text-secondary">
                {fmtCap(result.projectedAAV.low)} – {fmtCap(result.projectedAAV.high)}
              </p>
            </div>
            {result.factors && (
              <>
                {!result.factors.isGoalie && (
                  <div>
                    <p className="text-data-xs text-text-muted">Pts/82</p>
                    <p className="font-mono text-data-sm text-text-secondary">
                      {result.factors.pointsPer82}
                    </p>
                  </div>
                )}
                {result.factors.isGoalie && result.factors.savePercentage && (
                  <div>
                    <p className="text-data-xs text-text-muted">SV%</p>
                    <p className="font-mono text-data-sm text-text-secondary">
                      {result.factors.savePercentage.toFixed(3)}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          <p className="mt-2 text-data-xs text-text-muted">
            Based on position, age, production rate, and current market inflation.
          </p>
        </div>
      )}
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shared components
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

function PosFilter({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div className="flex gap-1">
      <PosBtn label="All" active={!value} onClick={() => onChange(undefined)} />
      {POSITIONS.map((p) => (
        <PosBtn
          key={p}
          label={p}
          active={value === p}
          onClick={() => onChange(p)}
        />
      ))}
    </div>
  );
}

function PosBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded px-3 py-1.5 text-data-xs font-medium transition-colors",
        active
          ? "bg-accent text-white"
          : "bg-surface-1 text-text-muted hover:bg-surface-2 hover:text-text-secondary",
      )}
    >
      {label}
    </button>
  );
}

function SortTh({
  field,
  label,
  active,
  dir,
  onClick,
  width,
  align,
}: {
  field: SortField;
  label: string;
  active: SortField;
  dir: SortDir;
  onClick: (f: SortField) => void;
  width?: string;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "cursor-pointer select-none px-3 py-2.5 text-data-xs font-medium uppercase tracking-wider text-text-muted transition-colors hover:text-text-secondary",
        align === "right" ? "text-right" : "text-left",
      )}
      style={width ? { width } : undefined}
      onClick={() => onClick(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active === field ? (
          dir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="mb-1 block text-data-xs text-text-muted">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-data-sm text-text-primary outline-none focus:border-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-data-xs text-text-muted">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-data-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
      />
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
