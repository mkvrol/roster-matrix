"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { TeamLogo } from "@/components/ui/team-logo";
import { PageHeader } from "@/components/ui/page-header";
import {
  Shield,
  Eye,
  Users,
  Sparkles,
  Crown,
  Loader2,
  Search,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

// ── Types ──

type TimeRange = "today" | "week" | "month" | "all";

const RANGES: { id: TimeRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "all", label: "All Time" },
];

// ── Helpers ──

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Page ──

export default function AnalyticsDashboardPage() {
  const { data: session } = useSession();
  const [range, setRange] = useState<TimeRange>("week");

  const { data, isLoading } = trpc.analytics.getDashboard.useQuery(
    { range },
    { staleTime: 30_000 },
  );

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
    <div className="space-y-6">
      <PageHeader
        title="Analytics Dashboard"
        subtitle="Track user engagement and feature usage across the platform"
      />

      {/* Time range filter */}
      <div className="flex items-center gap-1 rounded-md border border-border-subtle bg-surface-1 p-1 w-fit">
        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={cn(
              "rounded px-3 py-1.5 text-data-sm font-medium transition-colors",
              range === r.id
                ? "bg-accent text-white"
                : "text-text-muted hover:bg-surface-2 hover:text-text-secondary",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section 1 — Overview Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <OverviewCard
              icon={Eye}
              label="Total Page Views"
              value={fmtNumber(data.overview.totalPageViews)}
            />
            <OverviewCard
              icon={Users}
              label="Unique Users"
              value={fmtNumber(data.overview.uniqueUsers)}
            />
            <OverviewCard
              icon={Sparkles}
              label="AI Queries"
              value={fmtNumber(data.overview.totalAIQueries)}
            />
            <OverviewCard
              icon={Crown}
              label="Most Active User"
              value={data.overview.mostActiveUser?.name ?? "—"}
              subtext={
                data.overview.mostActiveUser
                  ? `${data.overview.mostActiveUser.count} events`
                  : undefined
              }
            />
          </div>

          {/* Section 2 — Most Viewed Players */}
          <Card title="Most Viewed Players" subtitle="Top 20 by page views">
            {data.topPlayers.length === 0 ? (
              <EmptyState text="No player views recorded yet" />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(300, data.topPlayers.length * 32)}>
                <BarChart
                  data={data.topPlayers}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis
                    type="category"
                    dataKey="playerName"
                    width={140}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <RechartsTooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [value, "Views"]}
                  />
                  <Bar dataKey="views" fill="#dc2626" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {data.topPlayers.length > 0 && (
              <div className="mt-3 space-y-1">
                {data.topPlayers.slice(0, 10).map((p, i) => (
                  <Link
                    key={p.playerId}
                    href={`/players/${p.playerId}`}
                    className="flex items-center gap-2 rounded px-2 py-1 text-data-sm transition-colors hover:bg-surface-2"
                  >
                    <span className="w-5 text-right font-mono text-text-muted">{i + 1}</span>
                    {p.teamAbbrev && <TeamLogo teamAbbrev={p.teamAbbrev} size="sm" />}
                    <span className="text-text-primary hover:text-accent">{p.playerName}</span>
                    <span className="ml-auto font-mono text-text-muted">{p.views}</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Section 3 — Most Viewed Teams */}
          <Card title="Most Viewed Teams" subtitle="Top 10 by page views">
            {data.topTeams.length === 0 ? (
              <EmptyState text="No team views recorded yet" />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, data.topTeams.length * 36)}>
                <BarChart
                  data={data.topTeams}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis
                    type="category"
                    dataKey="teamName"
                    width={160}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <RechartsTooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [value, "Views"]}
                  />
                  <Bar dataKey="views" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Section 4 — Feature Usage */}
          <Card title="Feature Usage" subtitle="Breakdown by feature area">
            {data.featureUsage.every((f) => f.count === 0) ? (
              <EmptyState text="No feature usage recorded yet" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.featureUsage} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="feature" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                  <RechartsTooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [value, "Uses"]}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Section 5 — AI Usage Over Time */}
            <Card title="AI Usage Over Time" subtitle="Daily AI queries">
              {data.aiTimeline.length === 0 ? (
                <EmptyState text="No AI queries recorded yet" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={data.aiTimeline} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#64748b" }}
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 10, fill: "#64748b" }} allowDecimals={false} />
                    <RechartsTooltip contentStyle={tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#8b5cf6" }}
                      name="Queries"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {data.topQueries.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-data-xs font-medium text-text-muted">Top AI Scout Queries</p>
                  <div className="space-y-1">
                    {data.topQueries.slice(0, 8).map((q) => (
                      <div key={q.query} className="flex items-center gap-2 text-data-xs">
                        <span className="flex-1 truncate text-text-secondary">&ldquo;{q.query}&rdquo;</span>
                        <span className="font-mono text-text-muted">{q.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Section 6 — Search Analytics */}
            <Card title="Search Analytics" subtitle="Most common search queries">
              {data.topSearches.length === 0 ? (
                <EmptyState text="No searches recorded yet" />
              ) : (
                <div className="space-y-1.5">
                  {data.topSearches.map((s, i) => (
                    <div
                      key={s.query}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-data-sm"
                    >
                      <span className="w-5 text-right font-mono text-text-muted">{i + 1}</span>
                      <Search className="h-3 w-3 text-text-muted" />
                      <span className="flex-1 truncate text-text-secondary">{s.query}</span>
                      <span className="font-mono text-text-muted">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared components ──

const tooltipStyle = {
  backgroundColor: "#111827",
  border: "1px solid #334155",
  borderRadius: "0.375rem",
  fontSize: "0.75rem",
};

function OverviewCard({
  icon: Icon,
  label,
  value,
  subtext,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
      <div className="flex items-center gap-2 text-text-muted">
        <Icon className="h-4 w-4" />
        <span className="text-data-xs">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-text-primary">{value}</p>
      {subtext && <p className="mt-0.5 text-data-xs text-text-muted">{subtext}</p>}
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {subtitle && <p className="text-data-xs text-text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-data-sm text-text-muted">{text}</p>
    </div>
  );
}
