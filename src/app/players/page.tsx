"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { ValueBadge } from "@/components/ui/value-badge";
import { TeamLogo } from "@/components/ui/team-logo";
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

// ── Types ──

const POSITIONS = ["C", "LW", "RW", "D", "G"] as const;

type SortField = "playerName" | "position" | "age" | "aav" | "overallScore";
type SortDir = "asc" | "desc";

// ── Main page ──

export default function PlayersPage() {
  const router = useRouter();
  const { data: teams } = trpc.league.getTeams.useQuery(undefined, {
    staleTime: 60 * 60 * 1000,
  });

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [position, setPosition] = useState<string | undefined>();
  const [teamId, setTeamId] = useState<string | undefined>();
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Sort + page
  const [sortBy, setSortBy] = useState<SortField>("overallScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  // Debounce search
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = (value: string) => {
    setSearch(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
    setDebounceTimer(timer);
  };

  const queryInput = useMemo(() => {
    const input: Record<string, unknown> = {
      sortBy,
      sortDir,
      page,
      perPage,
    };
    if (debouncedSearch) input.search = debouncedSearch;
    if (position) input.position = position;
    if (teamId) input.teamId = teamId;
    return input;
  }, [debouncedSearch, position, teamId, sortBy, sortDir, page, perPage]);

  const { data, isLoading } = trpc.league.getPlayers.useQuery(
    queryInput as Parameters<typeof trpc.league.getPlayers.useQuery>[0],
    { staleTime: 15 * 60 * 1000 },
  );

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(field === "playerName" ? "asc" : "desc");
    }
    setPage(1);
  };

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setPosition(undefined);
    setTeamId(undefined);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Players"
        subtitle="Search and evaluate NHL player contract values"
      />

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search players by name…"
          aria-label="Search players"
          className="w-full rounded-md border border-border-subtle bg-surface-1 py-2.5 pl-9 pr-4 text-data-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
        />
      </div>

      {/* Filter controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="flex items-center gap-1.5 rounded border border-border-subtle bg-surface-1 px-3 py-1.5 text-data-sm text-text-secondary transition-colors hover:bg-surface-2"
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
          </button>
          <PosFilter
            value={position}
            onChange={(v) => {
              setPosition(v);
              setPage(1);
            }}
          />
        </div>
        <button
          onClick={resetFilters}
          className="text-data-xs text-text-muted hover:text-text-secondary"
        >
          Clear all
        </button>
      </div>

      {/* Team filter */}
      {filtersOpen && (
        <div className="grid grid-cols-2 gap-3 rounded-md border border-border-subtle bg-surface-1 p-4 sm:grid-cols-3 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-data-xs text-text-muted">
              Team
            </label>
            <select
              value={teamId ?? ""}
              onChange={(e) => {
                setTeamId(e.target.value || undefined);
                setPage(1);
              }}
              className="w-full rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-data-sm text-text-primary outline-none focus:border-accent"
            >
              <option value="">All Teams</option>
              {teams?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.abbreviation} — {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-auto rounded-md border border-border-subtle">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-1">
              <th className="px-3 py-2.5 text-left text-data-xs font-medium uppercase tracking-wider text-text-muted" style={{ width: "40px" }}>
                #
              </th>
              <SortTh field="playerName" label="Player" active={sortBy} dir={sortDir} onClick={handleSort} />
              <SortTh field="position" label="POS" active={sortBy} dir={sortDir} onClick={handleSort} width="60px" />
              <th className="px-3 py-2.5 text-left text-data-xs font-medium uppercase tracking-wider text-text-muted" style={{ width: "65px" }}>
                Team
              </th>
              <SortTh field="age" label="Age" active={sortBy} dir={sortDir} onClick={handleSort} width="55px" align="right" />
              <SortTh field="aav" label="AAV" active={sortBy} dir={sortDir} onClick={handleSort} width="90px" align="right" />
              <th className="px-3 py-2.5 text-right text-data-xs font-medium uppercase tracking-wider text-text-muted" style={{ width: "60px" }}>
                Term
              </th>
              <SortTh field="overallScore" label="Value" active={sortBy} dir={sortDir} onClick={handleSort} width="120px" align="right" />
              <th className="px-3 py-2.5 text-left text-data-xs font-medium uppercase tracking-wider text-text-muted" style={{ width: "80px" }}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i} className="border-b border-border-subtle">
                  <td colSpan={9} className="px-3 py-2">
                    <div className="h-5 animate-pulse rounded bg-surface-2" />
                  </td>
                </tr>
              ))
            ) : data && data.rows.length > 0 ? (
              data.rows.map((row, i) => (
                <tr
                  key={row.playerId}
                  onClick={() => router.push(`/players/${row.playerId}`)}
                  className="cursor-pointer border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-2"
                >
                  <td className="px-3 py-2 font-mono text-data-xs text-text-muted">
                    {(data.page - 1) * data.perPage + i + 1}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-data-sm font-medium text-text-primary">
                      {row.playerName}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-data-sm text-text-secondary">
                    {row.position}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <TeamLogo teamAbbrev={row.teamAbbreviation} size="sm" />
                      <span className="font-mono text-data-sm text-text-secondary">
                        {row.teamAbbreviation ?? "FA"}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                    {row.age}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                    {row.aav > 0 ? fmtCap(row.aav) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                    {row.yearsRemaining > 0 ? `${row.yearsRemaining} yr` : "—"}
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
                      {row.hasFutureContract && (
                        <span className="rounded bg-info-muted px-1 py-0.5 text-data-xs text-info">
                          SIGNED
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
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-10 text-center text-data-sm text-text-muted"
                >
                  No players match your search
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex flex-col items-center gap-2 rounded-md border border-border-subtle bg-surface-1 px-4 py-2.5 sm:flex-row sm:justify-between">
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
              aria-label="Rows per page"
              className="rounded border border-border-subtle bg-surface-2 px-2 py-1 text-data-xs text-text-primary outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
              className="rounded p-2 text-text-muted transition-colors hover:bg-surface-2 disabled:opacity-30"
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
              aria-label="Next page"
              className="rounded p-2 text-text-muted transition-colors hover:bg-surface-2 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared components ──

function PosFilter({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
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
      aria-label={`Filter by position: ${label}`}
      aria-pressed={active}
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
      aria-sort={active === field ? (dir === "asc" ? "ascending" : "descending") : undefined}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(field);
        }
      }}
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

// ── Formatting ──

function fmtCap(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${abs}`;
}
