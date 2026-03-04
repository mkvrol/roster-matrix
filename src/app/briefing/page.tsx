"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { usePageView } from "@/lib/use-track";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  AlertTriangle,
  Clock,
} from "lucide-react";

export default function BriefingPage() {
  usePageView("/briefing");
  const { data: teams } = trpc.league.getTeams.useQuery(undefined, {
    staleTime: 60 * 60 * 1000,
  });
  const { data: userTeamId } = trpc.trade.getUserTeam.useQuery();

  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>();
  const teamId = selectedTeamId ?? userTeamId ?? undefined;

  const briefing = trpc.ai.generateBriefing.useMutation();

  const handleGenerate = () => {
    if (!teamId) return;
    briefing.mutate({ teamId });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Briefing"
        subtitle="AI-generated executive intelligence report for your team"
      />

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 rounded-md border border-border-subtle bg-surface-1 p-4">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-data-xs text-text-muted">
            Team
          </label>
          <select
            value={teamId ?? ""}
            onChange={(e) => setSelectedTeamId(e.target.value || undefined)}
            className="w-full rounded border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm text-text-primary outline-none focus:border-accent"
          >
            <option value="">Select a team…</option>
            {teams?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.abbreviation} — {t.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleGenerate}
          disabled={!teamId || briefing.isPending}
          className="flex items-center gap-2 rounded-md bg-accent px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {briefing.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {briefing.isPending ? "Generating…" : "Generate Briefing"}
        </button>
      </div>

      {/* Error */}
      {briefing.isError && (
        <div className="rounded-md border border-danger/30 bg-danger-muted px-4 py-3">
          <p className="text-data-sm text-danger">{briefing.error.message}</p>
        </div>
      )}

      {/* Result */}
      {briefing.data && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <SummaryCard
              icon={Users}
              label="Roster Size"
              value={String(briefing.data.summary.rosterSize)}
            />
            <SummaryCard
              icon={DollarSign}
              label="Cap Hit"
              value={fmtCap(briefing.data.summary.totalCapHit)}
            />
            <SummaryCard
              icon={DollarSign}
              label="Cap Space"
              value={fmtCap(briefing.data.summary.capSpace)}
              variant={briefing.data.summary.capSpace > 5_000_000 ? "success" : "danger"}
            />
            <SummaryCard
              icon={Clock}
              label="Expiring"
              value={String(briefing.data.summary.expiringContracts)}
              variant="warning"
            />
            <SummaryCard
              icon={TrendingUp}
              label="Outperformers"
              value={String(briefing.data.summary.outperformers)}
              variant="success"
            />
            <SummaryCard
              icon={TrendingDown}
              label="Underperformers"
              value={String(briefing.data.summary.underperformers)}
              variant="danger"
            />
          </div>

          {/* Briefing document */}
          <div className="rounded-md border border-border-subtle bg-surface-1">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-medium text-text-primary">
                  {briefing.data.teamName} — Weekly Intelligence Briefing
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-data-xs text-text-muted">
                  Generated{" "}
                  {new Date(briefing.data.generatedAt).toLocaleDateString(
                    "en-US",
                    { month: "short", day: "numeric", year: "numeric" },
                  )}
                </span>
                <button
                  onClick={handleGenerate}
                  disabled={briefing.isPending}
                  className="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-secondary"
                  aria-label="Regenerate briefing"
                >
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5",
                      briefing.isPending && "animate-spin",
                    )}
                  />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="prose prose-invert prose-sm max-w-none">
                <BriefingContent content={briefing.data.briefing} />
              </div>
            </div>
          </div>

          {/* AI disclaimer */}
          <div className="flex items-center gap-2 rounded-md bg-surface-2 px-4 py-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
            <p className="text-data-xs text-text-muted">
              This briefing was generated by Claude AI using current roster and
              contract data. All recommendations should be validated by your
              analytics team.
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!briefing.data && !briefing.isPending && !briefing.isError && (
        <div className="flex flex-col items-center justify-center rounded-md border border-border-subtle bg-surface-1 py-20">
          <Sparkles className="mb-4 h-10 w-10 text-text-muted" />
          <h3 className="text-lg font-medium text-text-primary">
            Generate Your Team Briefing
          </h3>
          <p className="mt-2 max-w-md text-center text-data-sm text-text-muted">
            Select a team and click &quot;Generate Briefing&quot; to create an
            AI-powered executive intelligence report covering roster value,
            trade opportunities, and cap outlook.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function SummaryCard({
  icon: Icon,
  label,
  value,
  variant,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  variant?: "success" | "danger" | "warning";
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-1 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-text-muted" />
        <span className="text-data-xs text-text-muted">{label}</span>
      </div>
      <p
        className={cn(
          "mt-1 font-mono text-lg font-semibold",
          variant === "success" && "text-success",
          variant === "danger" && "text-danger",
          variant === "warning" && "text-warning",
          !variant && "text-text-primary",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function BriefingContent({ content }: { content: string }) {
  // Parse markdown-like sections into styled HTML
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) {
      elements.push(<br key={i} />);
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h2
          key={i}
          className="mb-2 mt-6 text-base font-semibold text-text-primary first:mt-0"
        >
          {trimmed.replace("## ", "")}
        </h2>,
      );
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <h1
          key={i}
          className="mb-3 mt-6 text-lg font-bold text-text-primary first:mt-0"
        >
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

function fmtCap(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${abs}`;
}
