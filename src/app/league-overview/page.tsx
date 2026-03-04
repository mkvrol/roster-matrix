"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";
import {
  BarChart3,
  Trophy,
  Target,
  Users,
  TrendingUp,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
  ZAxis,
  LineChart,
  Line,
} from "recharts";
import { usePageView } from "@/lib/use-track";

// ── Types ──

type RouterOutput = inferRouterOutputs<AppRouter>;
type TeamEfficiency = RouterOutput["league"]["getTeamEfficiency"][number];
type PositionMarket = RouterOutput["league"]["getPositionMarket"][number];

type PositionFilter = "F" | "D" | "G" | undefined;

const POSITION_COLORS: Record<string, string> = {
  C: "#60a5fa",
  LW: "#10b981",
  RW: "#fbbf24",
  D: "#a78bfa",
  G: "#ef4444",
};

// ── Main page ──

export default function LeagueOverviewPage() {
  usePageView("/league-overview");
  return (
    <div className="space-y-6">
      <PageHeader
        title="League Overview"
        subtitle="League-wide value analytics, cap efficiency, and market trends"
      />
      <DistributionSection />
      <ValueRankingsSection />
      <CostPerWARSection />
      <CapEfficiencySection />
      <PositionMarketSection />
      <AgeCurveSection />
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. Value Score Distribution (Histogram)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DistributionSection() {
  const [position, setPosition] = useState<PositionFilter>(undefined);
  const [teamId, setTeamId] = useState<string>("");

  const { data: dist, isLoading } =
    trpc.value.getValueDistribution.useQuery({ position }, { staleTime: 60 * 60 * 1000 });
  const { data: teams } = trpc.league.getTeams.useQuery(undefined, { staleTime: 60 * 60 * 1000 });
  const { data: teamDist } = trpc.league.getTeamDistribution.useQuery(
    { teamId },
    { enabled: !!teamId, staleTime: 60 * 60 * 1000 },
  );

  const chartData = useMemo(() => {
    if (!dist) return [];
    return dist.buckets.map((b, i) => ({
      range: b.range.split(" ")[0],
      league: b.count,
      team: teamDist?.[i]?.count ?? 0,
    }));
  }, [dist, teamDist]);

  if (isLoading) return <CardSkeleton />;

  return (
    <Card
      title="Value Score Distribution"
      subtitle="How player value scores are distributed across the league"
      icon={BarChart3}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <PositionFilterBar value={position} onChange={setPosition} />
        <div className="flex items-center gap-2">
          <span className="text-data-xs text-text-muted">Team overlay:</span>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="rounded border border-border-subtle bg-surface-2 px-2 py-1 text-data-xs text-text-secondary outline-none"
          >
            <option value="">None</option>
            {teams?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.abbreviation}
              </option>
            ))}
          </select>
        </div>
      </div>

      {dist && (
        <div className="mb-4 flex gap-6">
          <StatPill label="Total" value={dist.total.toString()} />
          <StatPill label="Average" value={dist.average.toString()} />
          <StatPill label="Median" value={dist.median.toString()} />
        </div>
      )}

      <div className="h-48 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="range"
              tick={{ fontSize: 10, fill: "#64748b" }}
            />
            <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
            <RechartsTooltip
              contentStyle={tooltipStyle}
            />
            <Bar
              dataKey="league"
              name="League"
              fill="#283548"
              radius={[2, 2, 0, 0]}
            />
            {teamId && (
              <Bar
                dataKey="team"
                name="Team"
                fill="#dc2626"
                radius={[2, 2, 0, 0]}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. Value Score Rankings (horizontal BarChart)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ValueRankingsSection() {
  const [position, setPosition] = useState<PositionFilter>(undefined);

  const { data, isLoading } = trpc.value.getTopValuePlayers.useQuery(
    { limit: 30, position },
    { staleTime: 60 * 60 * 1000 },
  );

  if (isLoading) return <CardSkeleton />;

  const chartData = (data ?? []).map((p) => ({
    name: `${p.playerName} (${p.teamAbbreviation ?? "FA"})`,
    score: p.overallScore,
  }));

  return (
    <Card
      title="Value Score Rankings"
      subtitle="Top 30 players by overall value score"
      icon={Trophy}
    >
      <div className="mb-4">
        <PositionFilterBar value={position} onChange={setPosition} />
      </div>

      <div className="h-[400px] sm:h-[700px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ left: 140 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#64748b" }}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 9, fill: "#64748b" }}
              width={140}
            />
            <RechartsTooltip contentStyle={tooltipStyle} />
            <Bar dataKey="score" name="Value Score" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={getScoreColor(entry.score)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. Cost Per WAR Rankings
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CostPerWARSection() {
  const { data, isLoading } = trpc.league.getCostPerWAR.useQuery(undefined, { staleTime: 60 * 60 * 1000 });
  const { data: userTeamId } = trpc.league.getUserTeam.useQuery();

  if (isLoading) return <CardSkeleton />;

  const top25 = (data ?? []).slice(0, 25);
  const chartData = top25.map((p) => ({
    name: `${p.playerName} (${p.teamAbbreviation ?? "FA"})`,
    costPerWAR: Math.round(p.costPerWAR),
    isUserTeam: p.teamId === userTeamId,
  }));

  return (
    <Card
      title="Cost Per WAR Rankings"
      subtitle="Best value: lowest cost per win above replacement (top 25)"
      icon={Target}
    >
      <div className="h-[600px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ left: 140 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "#64748b" }}
              tickFormatter={(v: number) => fmtCap(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 9, fill: "#64748b" }}
              width={140}
            />
            <RechartsTooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => [fmtCap(value), "Cost/WAR"]}
            />
            <Bar dataKey="costPerWAR" name="Cost/WAR" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.isUserTeam ? "#dc2626" : "#283548"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. Cap Efficiency by Team (sortable table)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CapEfficiencySection() {
  const { data, isLoading } = trpc.league.getTeamEfficiency.useQuery(undefined, { staleTime: 60 * 60 * 1000 });

  const columns: Column<TeamEfficiency>[] = useMemo(
    () => [
      {
        key: "team",
        header: "Team",
        accessor: (r) => (
          <span className="font-sans font-medium text-text-primary">
            {r.abbreviation}
          </span>
        ),
        sortValue: (r) => r.teamName,
      },
      {
        key: "totalCap",
        header: "Cap Hit",
        accessor: (r) => fmtCap(r.totalCap),
        sortValue: (r) => r.totalCap,
        align: "right",
      },
      {
        key: "capSpace",
        header: "Cap Space",
        accessor: (r) => (
          <span className={r.capSpace < 0 ? "text-danger" : "text-success"}>
            {fmtCap(r.capSpace)}
          </span>
        ),
        sortValue: (r) => r.capSpace,
        align: "right",
      },
      {
        key: "playerCount",
        header: "Players",
        accessor: (r) => r.playerCount,
        sortValue: (r) => r.playerCount,
        align: "center",
      },
      {
        key: "avgScore",
        header: "Avg Score",
        accessor: (r) => (
          <span style={{ color: getScoreColor(r.avgScore) }}>
            {r.avgScore}
          </span>
        ),
        sortValue: (r) => r.avgScore,
        align: "center",
      },
      {
        key: "overpaid",
        header: "Overpaid",
        accessor: (r) => (
          <span className="text-danger">{r.overpaid}</span>
        ),
        sortValue: (r) => r.overpaid,
        align: "center",
      },
      {
        key: "underpaid",
        header: "Underpaid",
        accessor: (r) => (
          <span className="text-success">{r.underpaid}</span>
        ),
        sortValue: (r) => r.underpaid,
        align: "center",
      },
    ],
    [],
  );

  if (isLoading) return <CardSkeleton />;

  return (
    <Card
      title="Cap Efficiency by Team"
      subtitle="All columns sortable — click headers to sort"
      icon={Users}
    >
      <DataTable
        columns={columns}
        data={data ?? []}
        keyExtractor={(r) => r.teamId}
      />
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. Position Market
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function PositionMarketSection() {
  const { data, isLoading } = trpc.league.getPositionMarket.useQuery(undefined, { staleTime: 60 * 60 * 1000 });

  if (isLoading) return <CardSkeleton />;

  return (
    <Card
      title="Position Market"
      subtitle="Market overview by position — higher efficiency = better value per dollar"
      icon={TrendingUp}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(data ?? []).map((pos) => (
          <PositionCard key={pos.position} data={pos} />
        ))}
      </div>
    </Card>
  );
}

function PositionCard({ data }: { data: PositionMarket }) {
  const isHighEfficiency = data.efficiency >= 15;

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        isHighEfficiency
          ? "border-success/30 bg-success-muted"
          : "border-border-subtle bg-surface-2",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className="text-data-base font-semibold"
          style={{ color: POSITION_COLORS[data.position] ?? "#64748b" }}
        >
          {data.position}
        </span>
        <span className="text-data-xs text-text-muted">
          {data.playerCount} players
        </span>
      </div>
      <div className="space-y-1.5">
        <MarketStat label="Avg AAV" value={fmtCap(data.avgAAV)} />
        <MarketStat label="Median AAV" value={fmtCap(data.medianAAV)} />
        <MarketStat
          label="Avg Score"
          value={data.avgScore.toString()}
          valueColor={getScoreColor(data.avgScore)}
        />
        <MarketStat
          label="Efficiency"
          value={data.efficiency.toFixed(1)}
          valueColor={isHighEfficiency ? "#10b981" : undefined}
        />
        <MarketStat
          label="Bargains"
          value={data.bargainCount.toString()}
          valueColor="#60a5fa"
        />
      </div>
    </div>
  );
}

function MarketStat({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-data-xs text-text-muted">{label}</span>
      <span
        className="font-mono text-data-xs font-medium text-text-secondary"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. Age Curve Analysis (scatter plot)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AgeCurveSection() {
  const { data, isLoading } = trpc.league.getAgeCurveData.useQuery(undefined, { staleTime: 60 * 60 * 1000 });

  const positions = ["C", "LW", "RW", "D", "G"] as const;

  const trendData = useMemo(() => {
    if (!data) return [];
    const byAge: Record<number, number[]> = {};
    for (const p of data) {
      if (!byAge[p.age]) byAge[p.age] = [];
      byAge[p.age].push(p.overallScore);
    }
    return Object.entries(byAge)
      .map(([age, scores]) => ({
        age: Number(age),
        avgScore: Math.round(
          scores.reduce((a, b) => a + b, 0) / scores.length,
        ),
      }))
      .sort((a, b) => a.age - b.age);
  }, [data]);

  if (isLoading) return <CardSkeleton />;

  return (
    <Card
      title="Age Curve Analysis"
      subtitle="Value score vs age — colored by position, trend line shows average"
      icon={Activity}
    >
      <div className="mb-3 flex flex-wrap gap-3">
        {positions.map((pos) => (
          <div key={pos} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: POSITION_COLORS[pos] }}
            />
            <span className="text-data-xs text-text-muted">{pos}</span>
          </div>
        ))}
      </div>

      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              type="number"
              dataKey="age"
              name="Age"
              domain={[18, 42]}
              tick={{ fontSize: 10, fill: "#64748b" }}
              label={{
                value: "Age",
                position: "bottom",
                fill: "#64748b",
                fontSize: 10,
              }}
            />
            <YAxis
              type="number"
              dataKey="overallScore"
              name="Value Score"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#64748b" }}
            />
            <ZAxis range={[15, 15]} />
            <RechartsTooltip
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => [value, name]}
              labelFormatter={() => ""}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as {
                  playerName: string;
                  age: number;
                  overallScore: number;
                  position: string;
                  teamAbbreviation: string | null;
                };
                return (
                  <div
                    style={{
                      backgroundColor: "#111827",
                      border: "1px solid #334155",
                      borderRadius: "0.375rem",
                      fontSize: "0.75rem",
                      padding: "6px 8px",
                    }}
                  >
                    <p className="font-medium text-text-primary">
                      {d.playerName}
                    </p>
                    <p className="text-text-muted">
                      {d.position} · {d.teamAbbreviation ?? "FA"} · Age{" "}
                      {d.age}
                    </p>
                    <p className="text-text-secondary">
                      Score: {d.overallScore}
                    </p>
                  </div>
                );
              }}
            />
            {positions.map((pos) => (
              <Scatter
                key={pos}
                name={pos}
                data={(data ?? []).filter((p) => p.position === pos)}
                fill={POSITION_COLORS[pos]}
                opacity={0.6}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {trendData.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-data-xs text-text-muted">
            Average value score by age
          </p>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="age"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="avgScore"
                  name="Avg Score"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shared UI Components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function Card({
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

function PositionFilterBar({
  value,
  onChange,
}: {
  value: PositionFilter;
  onChange: (v: PositionFilter) => void;
}) {
  const options: { label: string; value: PositionFilter }[] = [
    { label: "All", value: undefined },
    { label: "F", value: "F" },
    { label: "D", value: "D" },
    { label: "G", value: "G" },
  ];

  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.label}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded px-2.5 py-1 text-data-xs font-medium transition-colors",
            value === opt.value
              ? "bg-accent text-white"
              : "bg-surface-2 text-text-muted hover:text-text-secondary",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-data-xs text-text-muted">{label}:</span>
      <span className="font-mono text-data-sm font-semibold text-text-primary">
        {value}
      </span>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="h-64 animate-pulse rounded-md border border-border-subtle bg-surface-1" />
  );
}

// ── Formatting helpers ──

const tooltipStyle = {
  backgroundColor: "#111827",
  border: "1px solid #334155",
  borderRadius: "0.375rem",
  fontSize: "0.75rem",
};

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
