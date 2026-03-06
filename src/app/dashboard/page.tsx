"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ValueBadge } from "@/components/ui/value-badge";
import { TeamLogo } from "@/components/ui/team-logo";
import { DataTable } from "@/components/ui/data-table";
import type { Column } from "@/components/ui/data-table";
import { Clock, ArrowLeftRight, ArrowRight, Award } from "lucide-react";
import { OnboardingTrigger } from "@/components/tour/onboarding-trigger";
import { usePageView } from "@/lib/use-track";

// ── Main page ──

export default function DashboardPage() {
  usePageView("/dashboard");
  return (
    <div className="space-y-6">
      <OnboardingTrigger />
      <div data-tour="dashboard-header">
        <PageHeader
          title="Command Center"
          subtitle="Contract value overview and intelligence feed"
        />
      </div>
      <MetricsBar />
      <CapSpaceTracker />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TeamSnapshot />
        </div>
        <div className="space-y-6">
          <div data-tour="value-leaders">
            <LeagueValueLeaders />
          </div>
          <ExpiringContractsWatch />
        </div>
      </div>
      <LeagueTransactions />
    </div>
  );
}

// ── Key Metrics Bar ──

function MetricsBar() {
  const { data, isLoading } = trpc.dashboard.getMetrics.useQuery(undefined, {
    staleTime: 15 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-md border border-border-subtle bg-surface-1"
          />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Cap Hit"
        value={data.hasTeam ? formatCap(data.capHit) : "—"}
        subText={
          data.hasTeam
            ? `of ${formatCap(data.capCeiling)} ceiling`
            : "Set your team in Settings"
        }
        variant="accent"
      />
      <StatCard
        label="Avg Value Score"
        value={data.avgScore}
        subText={`${data.totalPlayers} players scored`}
        variant="info"
      />
      <StatCard
        label="Outperforming"
        value={data.outperformers}
        subText="Value score 60+"
        variant="success"
      />
      <StatCard
        label="Underperforming"
        value={data.underperformers}
        subText="Value score below 40"
        variant="danger"
      />
    </div>
  );
}

// ── Cap Space Tracker ──

function CapSpaceTracker() {
  const { data, isLoading } = trpc.dashboard.getCapSummary.useQuery(undefined, {
    staleTime: 15 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="h-36 animate-pulse rounded-md border border-border-subtle bg-surface-1" />
    );
  }

  if (!data) {
    return (
      <div className="rounded-md border border-border-subtle bg-surface-1 px-4 py-3">
        <p className="text-data-sm text-text-muted">
          Set your primary team in Settings to see cap space tracking.
        </p>
      </div>
    );
  }

  const usagePct = Math.min((data.currentCapHit / data.capCeiling) * 100, 100);
  const projectedPct = Math.min(
    (data.projectedNextYear / data.projectedCeiling) * 100,
    100,
  );

  return (
    <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
      <h3 className="text-data-xs font-medium uppercase tracking-wider text-text-muted">
        Cap Space Tracker
      </h3>
      <div className="mt-3 space-y-4">
        {/* Current year */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-data-sm text-text-secondary">
              2025–26 Cap Usage
            </span>
            <span className="font-mono text-data-sm text-text-primary">
              {formatCap(data.currentCapHit)} / {formatCap(data.capCeiling)}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                usagePct > 95
                  ? "bg-danger"
                  : usagePct > 85
                    ? "bg-warning"
                    : "bg-info",
              )}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <p className="mt-1 text-data-xs text-text-muted">
            {formatCap(data.capSpace)} remaining · {data.contractCount}{" "}
            contracts
          </p>
        </div>

        {/* Projected next year */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-data-sm text-text-secondary">
              2026–27 Projected
            </span>
            <span className="font-mono text-data-sm text-text-primary">
              {formatCap(data.projectedNextYear)} /{" "}
              {formatCap(data.projectedCeiling)}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-purple transition-all duration-500"
              style={{ width: `${projectedPct}%` }}
            />
          </div>
          <p className="mt-1 text-data-xs text-text-muted">
            {formatCap(data.projectedNextYearSpace)} projected space
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Team Snapshot ──

function TeamSnapshot() {
  const { data, isLoading } = trpc.dashboard.getTeamRoster.useQuery(undefined, {
    staleTime: 60 * 60 * 1000,
  });
  const router = useRouter();

  if (isLoading) {
    return (
      <SectionCard title="Team Snapshot">
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded bg-surface-2"
            />
          ))}
        </div>
      </SectionCard>
    );
  }

  if (!data || data.players.length === 0) {
    return (
      <SectionCard title="Team Snapshot">
        <p className="py-10 text-center text-sm text-text-muted">
          No value scores calculated yet. Run a batch calculation to populate
          the dashboard.
        </p>
      </SectionCard>
    );
  }

  type Player = (typeof data)["players"][number];

  const columns: Column<Player>[] = [
    {
      key: "player",
      header: "Player",
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <TeamLogo teamAbbrev={row.teamAbbreviation} size="sm" />
          <span className="font-medium text-text-primary">
            {row.playerName}
          </span>
          {!data.isTeamView && row.teamAbbreviation && (
            <span className="text-data-xs text-text-muted">
              {row.teamAbbreviation}
            </span>
          )}
        </div>
      ),
      sortValue: (row) => row.playerName,
    },
    {
      key: "position",
      header: "POS",
      accessor: (row) => row.position,
      sortValue: (row) => row.position,
      width: "55px",
    },
    {
      key: "aav",
      header: "AAV",
      accessor: (row) => (
        <span className="text-text-secondary">{formatAAV(row.aav)}</span>
      ),
      sortValue: (row) => row.aav,
      align: "right" as const,
      width: "85px",
    },
    {
      key: "points",
      header: "PTS",
      accessor: (row) => row.points,
      sortValue: (row) => row.points,
      align: "right" as const,
      width: "55px",
    },
    {
      key: "gp",
      header: "GP",
      accessor: (row) => row.gamesPlayed,
      sortValue: (row) => row.gamesPlayed,
      align: "right" as const,
      width: "50px",
    },
    {
      key: "value",
      header: "Value",
      accessor: (row) => <ValueBadge score={row.overallScore} size="sm" />,
      sortValue: (row) => row.overallScore,
      align: "right" as const,
      width: "140px",
    },
    {
      key: "trend",
      header: "Trend",
      accessor: (row) => <Sparkline data={row.sparkline} />,
      align: "center" as const,
      width: "70px",
    },
  ];

  return (
    <SectionCard
      title={data.isTeamView ? "Your Team Snapshot" : "Top Value Players"}
      subtitle={
        data.isTeamView
          ? `${data.players.length} rostered players`
          : "League-wide · Set your team in Settings for team view"
      }
    >
      <DataTable
        columns={columns}
        data={data.players}
        keyExtractor={(row) => row.playerId}
        onRowClick={(row) => router.push(`/players/${row.playerId}`)}
      />
    </SectionCard>
  );
}

// ── League Value Leaders ──

function LeagueValueLeaders() {
  const { data, isLoading } = trpc.value.getTopValuePlayers.useQuery({
    limit: 10,
  });
  const router = useRouter();

  if (isLoading) {
    return (
      <SectionCard title="League Value Leaders">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-8 animate-pulse rounded bg-surface-2"
            />
          ))}
        </div>
      </SectionCard>
    );
  }

  if (!data || data.length === 0) {
    return (
      <SectionCard title="League Value Leaders">
        <EmptyState text="No value data available" />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="League Value Leaders">
      <div className="space-y-2">
        {data.map((player, i) => (
          <button
            key={player.playerId}
            onClick={() => router.push(`/players/${player.playerId}`)}
            className="group flex w-full items-center gap-3 rounded px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2"
          >
            <span className="w-5 text-right font-mono text-data-xs text-text-muted">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-data-sm font-medium text-text-primary group-hover:text-accent">
                  {player.playerName}
                </span>
                <span className="shrink-0 text-data-xs text-text-muted">
                  {player.teamAbbreviation}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${player.overallScore}%`,
                    backgroundColor: getScoreColor(player.overallScore),
                  }}
                />
              </div>
            </div>
            <span
              className="shrink-0 font-mono text-data-sm font-semibold tabular-nums"
              style={{ color: getScoreColor(player.overallScore) }}
            >
              {player.overallScore}
            </span>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

// ── Expiring Contracts Watch ──

function ExpiringContractsWatch() {
  const { data, isLoading } = trpc.dashboard.getExpiringContracts.useQuery(
    { limit: 8 },
    { staleTime: 60 * 60 * 1000 },
  );
  const router = useRouter();

  if (isLoading) {
    return (
      <SectionCard title="Expiring Contracts Watch" icon={Clock}>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-8 animate-pulse rounded bg-surface-2"
            />
          ))}
        </div>
      </SectionCard>
    );
  }

  if (!data || data.length === 0) {
    return (
      <SectionCard title="Expiring Contracts Watch" icon={Clock}>
        <EmptyState text="No expiring contracts found" />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Expiring Contracts Watch" icon={Clock}>
      <div className="space-y-1">
        {data.map((contract) => (
          <button
            key={contract.playerId}
            onClick={() => router.push(`/players/${contract.playerId}`)}
            className="group flex w-full items-center justify-between gap-2 rounded px-1.5 py-1.5 text-left transition-colors hover:bg-surface-2"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-data-sm font-medium text-text-primary group-hover:text-accent">
                  {contract.playerName}
                </span>
                <span className="shrink-0 text-data-xs text-text-muted">
                  {contract.position} · {contract.teamAbbreviation}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-data-xs text-text-muted">
                {formatAAV(contract.aav)}
              </span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-data-xs font-medium",
                  contract.expiresThisYear
                    ? "bg-danger-muted text-danger"
                    : "bg-warning-muted text-warning",
                )}
              >
                {contract.expiresThisYear ? "This Yr" : "Next Yr"}
              </span>
              <span
                className="w-6 text-right font-mono text-data-sm font-semibold tabular-nums"
                style={{ color: getScoreColor(contract.overallScore) }}
              >
                {contract.overallScore}
              </span>
            </div>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

// ── League Transactions ──

const TX_COLORS: Record<string, { bg: string; text: string }> = {
  TRADE: { bg: "bg-info-muted", text: "text-info" },
  SIGNING: { bg: "bg-success-muted", text: "text-success" },
  WAIVER: { bg: "bg-warning-muted", text: "text-warning" },
  RECALL: { bg: "bg-purple-muted", text: "text-purple" },
};

type RecentTransaction = {
  id: string;
  type: string;
  description: string;
  playersInvolved: unknown;
  date: Date;
  team: { id: string; name: string; abbreviation: string };
};

function LeagueTransactions() {
  const { data, isLoading } = trpc.dashboard.getRecentTransactions.useQuery(
    undefined,
    { staleTime: 5 * 60 * 1000 },
  ) as { data: RecentTransaction[] | undefined; isLoading: boolean };
  const router = useRouter();

  if (isLoading) {
    return (
      <SectionCard title="League Transactions" icon={ArrowLeftRight}>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded bg-surface-2"
            />
          ))}
        </div>
      </SectionCard>
    );
  }

  if (!data || data.length === 0) {
    return (
      <SectionCard title="League Transactions" icon={ArrowLeftRight}>
        <EmptyState text="No recent transactions" />
      </SectionCard>
    );
  }

  // Parse trade abbreviations from description ("X traded from AAA to BBB")
  const parseTrade = (desc: string) => {
    const m = desc.match(/^(.+?)\s+traded from\s+(\w+)\s+to\s+(\w+)$/);
    if (m) return { playerName: m[1], from: m[2], to: m[3] };
    return null;
  };

  return (
    <SectionCard title="League Transactions" icon={ArrowLeftRight}>
      <div className="max-h-[400px] space-y-1 overflow-y-auto">
        {data.map((tx) => {
          const colors = TX_COLORS[tx.type] ?? {
            bg: "bg-surface-2",
            text: "text-text-muted",
          };
          const trade = tx.type === "TRADE" ? parseTrade(tx.description) : null;

          return (
            <div
              key={tx.id}
              className="flex items-center gap-3 rounded px-1.5 py-2 transition-colors hover:bg-surface-2"
            >
              <span className="w-16 shrink-0 text-data-xs text-text-muted">
                {new Date(tx.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              {trade ? (
                <div className="flex shrink-0 items-center gap-1">
                  <TeamLogo teamAbbrev={trade.from} size="sm" />
                  <ArrowRight className="h-3 w-3 text-text-muted" />
                  <TeamLogo teamAbbrev={trade.to} size="sm" />
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-1.5">
                  <TeamLogo teamAbbrev={tx.team.abbreviation} size="sm" />
                  <span className="text-data-xs font-medium text-text-secondary">
                    {tx.team.abbreviation}
                  </span>
                </div>
              )}
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-data-xs font-medium",
                  colors.bg,
                  colors.text,
                )}
              >
                {tx.type}
              </span>
              <span className="min-w-0 flex-1 truncate text-data-sm text-text-secondary">
                {tx.description}
              </span>
              {tx.type === "TRADE" && (
                <button
                  onClick={() =>
                    router.push(`/trade-analyzer?gradeTradeId=${tx.id}`)
                  }
                  className="flex shrink-0 items-center gap-1 rounded bg-accent/10 px-2 py-1 text-data-xs font-medium text-accent transition-colors hover:bg-accent/20"
                >
                  <Award className="h-3 w-3" />
                  Grade
                </button>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ── Shared UI helpers ──

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border-subtle bg-surface-1",
        className,
      )}
    >
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

function EmptyState({ text }: { text: string }) {
  return (
    <p className="py-6 text-center text-data-sm text-text-muted">{text}</p>
  );
}

function Sparkline({
  data,
  width = 60,
  height = 20,
}: {
  data: number[];
  width?: number;
  height?: number;
}) {
  if (data.length < 2) {
    return <span className="text-data-xs text-text-muted">—</span>;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (v - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const trending = data[data.length - 1] >= data[0];
  const color = trending ? "#10b981" : "#ef4444";

  return (
    <svg
      width={width}
      height={height}
      className="inline-block"
      aria-label={`Value trend: ${data[0]} → ${data[data.length - 1]}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

function formatCap(value: number): string {
  return `$${(value / 1_000_000).toFixed(1)}M`;
}

function formatAAV(aav: number): string {
  if (aav >= 1_000_000) return `$${(aav / 1_000_000).toFixed(1)}M`;
  if (aav >= 1_000) return `$${Math.round(aav / 1_000)}K`;
  return `$${aav}`;
}
