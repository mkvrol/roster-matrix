"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/page-header";
import { ValueBadge } from "@/components/ui/value-badge";
import {
  FileText,
  Trash2,
  ChevronLeft,
  Clock,
  Calendar,
  Download,
  Pencil,
} from "lucide-react";

// ── Types ──

type ReportType =
  | "PLAYER_EVAL"
  | "TRADE_ANALYSIS"
  | "CONTRACT_PROJECTION"
  | "COMPARISON"
  | "CUSTOM";

interface PlayerConfig {
  fullName: string;
  position: string;
  age: number;
  team: string | null;
  headshotUrl: string | null;
}

interface ValueScoreConfig {
  overallScore: number;
  grade: string | null;
  components: Record<string, number> | null;
  estimatedWAR: number | null;
  leagueRank: number | null;
  peerRank: number | null;
}

interface ContractConfig {
  aav: number;
  totalYears: number;
  startYear: number;
  endYear: number;
  yearsRemaining: number;
  hasNTC: boolean;
  hasNMC: boolean;
  signingType: string | null;
}

interface StatsConfig {
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  toiPerGame: number | null;
}

interface AdvancedConfig {
  corsiForPct: number | null;
  xGFPct: number | null;
  goalsForPct: number | null;
}

interface ProjectionConfig {
  projectedAAV: { low: number; mid: number; high: number };
  projectedTerm: { low: number; mid: number; high: number };
  confidence: number;
  comparables: Array<{
    playerName: string;
    aav: number;
    term: number;
    ageAtSigning: number;
    productionAtSigning: number;
  }>;
}

interface ComparablesConfig {
  rank: number;
  percentile: number;
  summary: string;
  peers: Array<{
    playerName: string;
    position: string;
    age: number;
    aav: number;
    totalYears: number;
    valueScore: number;
    points: number;
    gamesPlayed: number;
  }>;
}

interface ReportConfiguration {
  player?: PlayerConfig;
  valueScore?: ValueScoreConfig | null;
  contract?: ContractConfig | null;
  stats?: StatsConfig | null;
  advanced?: AdvancedConfig | null;
  projection?: ProjectionConfig | null;
  comparables?: ComparablesConfig | null;
  notes?: string;
  gmNote?: string;
  generatedAt?: string;
}

const TYPE_BADGE: Record<
  ReportType,
  { label: string; bg: string; text: string }
> = {
  PLAYER_EVAL: { label: "Player Eval", bg: "bg-info-muted", text: "text-info" },
  TRADE_ANALYSIS: {
    label: "Trade Analysis",
    bg: "bg-purple-muted",
    text: "text-purple",
  },
  CONTRACT_PROJECTION: {
    label: "Contract Projection",
    bg: "bg-warning-muted",
    text: "text-warning",
  },
  COMPARISON: {
    label: "Comparison",
    bg: "bg-success-muted",
    text: "text-success",
  },
  CUSTOM: {
    label: "Custom",
    bg: "bg-surface-2",
    text: "text-text-secondary",
  },
};

// ── Formatting helpers ──

function fmtCap(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${abs}`;
}

function fmtDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Main page ──

export default function ReportsPage() {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  if (selectedReportId) {
    return (
      <ReportDetail
        reportId={selectedReportId}
        onBack={() => setSelectedReportId(null)}
      />
    );
  }

  return <ReportList onSelect={setSelectedReportId} />;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Report List
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ReportList({ onSelect }: { onSelect: (id: string) => void }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data: reports, isLoading } = trpc.report.getReports.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const deleteMutation = trpc.report.deleteReport.useMutation({
    onSuccess: () => {
      utils.report.getReports.invalidate();
      toast({ variant: "success", title: "Report deleted" });
    },
  });

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteMutation.mutate({ id });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Saved Reports"
          subtitle="Player evaluation reports and analysis"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-md border border-border-subtle bg-surface-1 p-4"
            >
              <div className="mb-3 h-4 w-2/3 rounded bg-surface-2" />
              <div className="mb-2 h-3 w-1/3 rounded bg-surface-2" />
              <div className="mb-4 h-3 w-1/2 rounded bg-surface-2" />
              <div className="flex justify-between">
                <div className="h-3 w-1/4 rounded bg-surface-2" />
                <div className="h-3 w-1/4 rounded bg-surface-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved Reports"
        subtitle="Player evaluation reports and analysis"
      />

      {!reports || reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-border-subtle bg-surface-1 py-16">
          <FileText className="mb-3 h-10 w-10 text-text-muted" />
          <p className="text-sm font-medium text-text-secondary">
            No reports yet
          </p>
          <p className="mt-1 text-data-xs text-text-muted">
            Generate a report from any player&apos;s detail page.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => {
            const config = report.type as ReportType;
            const badge = TYPE_BADGE[config] ?? TYPE_BADGE.CUSTOM;

            return (
              <button
                key={report.id}
                onClick={() => onSelect(report.id)}
                className="group rounded-md border border-border-subtle bg-surface-1 p-4 text-left transition-colors hover:border-accent/40 hover:bg-surface-2"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="text-sm font-medium text-text-primary line-clamp-2">
                    {report.title}
                  </h3>
                  <button
                    onClick={(e) => handleDelete(report.id, e)}
                    disabled={deleteMutation.isPending}
                    className="shrink-0 rounded p-1 text-text-muted opacity-0 transition-all hover:bg-danger-muted hover:text-danger group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <span
                  className={cn(
                    "inline-flex rounded px-1.5 py-0.5 text-data-xs font-medium",
                    badge.bg,
                    badge.text,
                  )}
                >
                  {badge.label}
                </span>

                <div className="mt-3 flex items-center gap-3 text-data-xs text-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {fmtDate(report.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {fmtDate(report.updatedAt)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Report Detail
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ReportDetail({
  reportId,
  onBack,
}: {
  reportId: string;
  onBack: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: report, isLoading } = trpc.report.getReport.useQuery({
    id: reportId,
  });

  const updateMutation = trpc.report.updateReport.useMutation({
    onSuccess: () => {
      utils.report.getReport.invalidate({ id: reportId });
      utils.report.getReports.invalidate();
    },
  });

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [notesDraft, setNotesDraft] = useState("");
  const [notesInitialized, setNotesInitialized] = useState(false);

  const reportConfig = (report as { configuration?: unknown })?.configuration as ReportConfiguration | undefined;

  useEffect(() => {
    if (reportConfig && !notesInitialized) {
      setNotesDraft(reportConfig.notes ?? "");
      setNotesInitialized(true);
    }
  }, [reportConfig, notesInitialized]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  const saveTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== report?.title) {
      updateMutation.mutate({ id: reportId, title: trimmed });
    }
    setEditingTitle(false);
  };

  const saveNotes = () => {
    if (notesDraft !== (reportConfig?.notes ?? "")) {
      updateMutation.mutate({ id: reportId, notes: notesDraft });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 animate-pulse rounded bg-surface-2" />
        <div className="h-48 animate-pulse rounded-md border border-border-subtle bg-surface-1" />
        <div className="h-32 animate-pulse rounded-md border border-border-subtle bg-surface-1" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-data-sm text-text-muted hover:text-text-secondary"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to reports
        </button>
        <p className="text-sm text-text-muted">Report not found.</p>
      </div>
    );
  }

  const config = reportConfig!;
  const badge = TYPE_BADGE[(report.type as ReportType)] ?? TYPE_BADGE.CUSTOM;

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <button
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-data-sm text-text-muted hover:text-text-secondary"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to reports
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                className="w-full rounded border border-border-subtle bg-surface-2 px-2 py-1 text-xl font-semibold tracking-tight text-text-primary outline-none focus:border-accent"
              />
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-text-primary">
                  {report.title}
                </h1>
                <button
                  onClick={() => {
                    setTitleDraft(report.title);
                    setEditingTitle(true);
                  }}
                  className="rounded p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-secondary"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="mt-1 flex items-center gap-3">
              <span
                className={cn(
                  "inline-flex rounded px-1.5 py-0.5 text-data-xs font-medium",
                  badge.bg,
                  badge.text,
                )}
              >
                {badge.label}
              </span>
              <span className="text-data-xs text-text-muted">
                Created {fmtDate(report.createdAt)}
              </span>
            </div>
          </div>
          <a
            href={`/api/export/report?id=${reportId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded border border-border-subtle bg-surface-2 px-3 py-1.5 text-data-xs text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <Download className="h-3.5 w-3.5" />
            Export PDF
          </a>
        </div>
      </div>

      {/* Player header */}
      {config.player && (
        <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
          <div className="flex items-center gap-4">
            {config.player.headshotUrl && (
              <img
                src={config.player.headshotUrl}
                alt={config.player.fullName}
                className="h-16 w-16 rounded-full border border-border-subtle bg-surface-2 object-cover"
              />
            )}
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                {config.player.fullName}
              </h2>
              <p className="text-data-sm text-text-muted">
                {config.player.position}
                {config.player.team && ` · ${config.player.team}`}
                {` · Age ${config.player.age}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Value Score */}
      {config.valueScore && (
        <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
          <h3 className="mb-3 text-sm font-medium text-text-primary">
            Value Score
          </h3>
          <div className="flex flex-wrap items-center gap-4">
            <ValueBadge score={config.valueScore.overallScore} />
            {config.valueScore.estimatedWAR != null && (
              <div>
                <p className="text-data-xs text-text-muted">Est. WAR</p>
                <p className="font-mono text-data-sm font-semibold text-text-primary">
                  {config.valueScore.estimatedWAR.toFixed(1)}
                </p>
              </div>
            )}
            {config.valueScore.leagueRank != null && (
              <div>
                <p className="text-data-xs text-text-muted">League Rank</p>
                <p className="font-mono text-data-sm font-semibold text-text-primary">
                  #{config.valueScore.leagueRank}
                </p>
              </div>
            )}
            {config.valueScore.peerRank != null && (
              <div>
                <p className="text-data-xs text-text-muted">Peer Rank</p>
                <p className="font-mono text-data-sm font-semibold text-text-primary">
                  #{config.valueScore.peerRank}
                </p>
              </div>
            )}
          </div>

          {/* Component breakdown */}
          {config.valueScore.components && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(config.valueScore.components).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className="rounded border border-border-subtle bg-surface-2 px-3 py-2"
                  >
                    <p className="text-data-xs text-text-muted capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </p>
                    <p className="font-mono text-data-sm font-semibold text-text-primary">
                      {typeof value === "number" ? value.toFixed(1) : String(value)}
                    </p>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      )}

      {/* Contract details */}
      {config.contract && (
        <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
          <h3 className="mb-3 text-sm font-medium text-text-primary">
            Contract
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Stat label="AAV" value={fmtCap(config.contract.aav)} />
            <Stat
              label="Term"
              value={`${config.contract.totalYears} yr${config.contract.totalYears !== 1 ? "s" : ""}`}
            />
            <Stat
              label="Years Remaining"
              value={String(config.contract.yearsRemaining)}
            />
            <Stat
              label="Period"
              value={`${config.contract.startYear}–${config.contract.endYear}`}
            />
            <Stat
              label="NTC"
              value={config.contract.hasNTC ? "Yes" : "No"}
            />
            <Stat
              label="NMC"
              value={config.contract.hasNMC ? "Yes" : "No"}
            />
            {config.contract.signingType && (
              <Stat label="Signing Type" value={config.contract.signingType} />
            )}
          </div>
        </div>
      )}

      {/* Season stats */}
      {config.stats && (
        <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
          <h3 className="mb-3 text-sm font-medium text-text-primary">
            Season Stats
          </h3>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <Stat label="GP" value={String(config.stats.gamesPlayed)} />
            <Stat label="G" value={String(config.stats.goals)} />
            <Stat label="A" value={String(config.stats.assists)} />
            <Stat label="PTS" value={String(config.stats.points)} />
            <Stat
              label="+/−"
              value={
                config.stats.plusMinus >= 0
                  ? `+${config.stats.plusMinus}`
                  : String(config.stats.plusMinus)
              }
            />
            {config.stats.toiPerGame != null && (
              <Stat
                label="TOI/GP"
                value={config.stats.toiPerGame.toFixed(1)}
              />
            )}
          </div>
        </div>
      )}

      {/* Advanced stats */}
      {config.advanced && (
        <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
          <h3 className="mb-3 text-sm font-medium text-text-primary">
            Advanced Stats
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {config.advanced.corsiForPct != null && (
              <Stat
                label="CF%"
                value={`${config.advanced.corsiForPct.toFixed(1)}%`}
              />
            )}
            {config.advanced.xGFPct != null && (
              <Stat
                label="xGF%"
                value={`${config.advanced.xGFPct.toFixed(1)}%`}
              />
            )}
            {config.advanced.goalsForPct != null && (
              <Stat
                label="GF%"
                value={`${config.advanced.goalsForPct.toFixed(1)}%`}
              />
            )}
          </div>
        </div>
      )}

      {/* Projection */}
      {config.projection && (
        <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
          <h3 className="mb-3 text-sm font-medium text-text-primary">
            Contract Projection
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Stat
              label="Projected AAV (Low)"
              value={fmtCap(config.projection.projectedAAV.low)}
            />
            <Stat
              label="Projected AAV (Mid)"
              value={fmtCap(config.projection.projectedAAV.mid)}
            />
            <Stat
              label="Projected AAV (High)"
              value={fmtCap(config.projection.projectedAAV.high)}
            />
            <Stat
              label="Term (Low)"
              value={`${config.projection.projectedTerm.low} yr${config.projection.projectedTerm.low !== 1 ? "s" : ""}`}
            />
            <Stat
              label="Term (Mid)"
              value={`${config.projection.projectedTerm.mid} yr${config.projection.projectedTerm.mid !== 1 ? "s" : ""}`}
            />
            <Stat
              label="Term (High)"
              value={`${config.projection.projectedTerm.high} yr${config.projection.projectedTerm.high !== 1 ? "s" : ""}`}
            />
          </div>
          <div className="mt-3">
            <p className="mb-1 text-data-xs text-text-muted">
              Confidence: {config.projection.confidence}%
            </p>
            <div className="h-2 w-full rounded-full bg-surface-2">
              <div
                className="h-2 rounded-full bg-accent"
                style={{ width: `${config.projection.confidence}%` }}
              />
            </div>
          </div>
          {config.projection.comparables.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-data-xs font-medium text-text-muted">
                Historical Comparables
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-data-xs">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-muted">
                      <th className="pb-1 pr-4 font-medium">Player</th>
                      <th className="pb-1 pr-4 font-medium">AAV</th>
                      <th className="pb-1 pr-4 font-medium">Term</th>
                      <th className="pb-1 pr-4 font-medium">Age</th>
                      <th className="pb-1 font-medium">Production</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.projection.comparables.map((comp) => (
                      <tr
                        key={comp.playerName}
                        className="border-b border-border-subtle last:border-0"
                      >
                        <td className="py-1.5 pr-4 text-text-primary">
                          {comp.playerName}
                        </td>
                        <td className="py-1.5 pr-4 font-mono text-text-primary">
                          {fmtCap(comp.aav)}
                        </td>
                        <td className="py-1.5 pr-4 text-text-primary">
                          {comp.term} yr{comp.term !== 1 ? "s" : ""}
                        </td>
                        <td className="py-1.5 pr-4 text-text-primary">
                          {comp.ageAtSigning}
                        </td>
                        <td className="py-1.5 font-mono text-text-primary">
                          {comp.productionAtSigning}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Peer Comparables */}
      {config.comparables && (
        <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
          <h3 className="mb-3 text-sm font-medium text-text-primary">
            Peer Comparables
          </h3>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Stat label="Rank" value={`#${config.comparables.rank}`} />
            <Stat
              label="Percentile"
              value={`${config.comparables.percentile}%`}
            />
          </div>
          <p className="mb-4 text-data-sm leading-relaxed text-text-secondary">
            {config.comparables.summary}
          </p>
          {config.comparables.peers.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-data-xs">
                <thead>
                  <tr className="border-b border-border-subtle text-text-muted">
                    <th className="pb-1 pr-4 font-medium">Player</th>
                    <th className="pb-1 pr-4 font-medium">POS</th>
                    <th className="pb-1 pr-4 font-medium">Age</th>
                    <th className="pb-1 pr-4 font-medium">AAV</th>
                    <th className="pb-1 pr-4 font-medium">Term</th>
                    <th className="pb-1 pr-4 font-medium">Score</th>
                    <th className="pb-1 pr-4 font-medium">PTS</th>
                    <th className="pb-1 font-medium">GP</th>
                  </tr>
                </thead>
                <tbody>
                  {config.comparables.peers.map((peer) => (
                    <tr
                      key={peer.playerName}
                      className="border-b border-border-subtle last:border-0"
                    >
                      <td className="py-1.5 pr-4 text-text-primary">
                        {peer.playerName}
                      </td>
                      <td className="py-1.5 pr-4 text-text-primary">
                        {peer.position}
                      </td>
                      <td className="py-1.5 pr-4 text-text-primary">
                        {peer.age}
                      </td>
                      <td className="py-1.5 pr-4 font-mono text-text-primary">
                        {fmtCap(peer.aav)}
                      </td>
                      <td className="py-1.5 pr-4 text-text-primary">
                        {peer.totalYears} yr{peer.totalYears !== 1 ? "s" : ""}
                      </td>
                      <td className="py-1.5 pr-4 font-mono text-text-primary">
                        {peer.valueScore.toFixed(1)}
                      </td>
                      <td className="py-1.5 pr-4 font-mono text-text-primary">
                        {peer.points}
                      </td>
                      <td className="py-1.5 font-mono text-text-primary">
                        {peer.gamesPlayed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Editable Notes */}
      <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
        <h3 className="mb-2 text-sm font-medium text-text-primary">
          Notes
        </h3>
        <textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={saveNotes}
          placeholder="Add your notes or annotations…"
          rows={4}
          className="w-full resize-y rounded border border-border-subtle bg-surface-2 px-3 py-2 text-data-sm leading-relaxed text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
        />
      </div>

      {/* GM Note */}
      {config.gmNote && (
        <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
          <h3 className="mb-2 text-sm font-medium text-text-primary">
            GM Note
          </h3>
          <p className="text-data-sm leading-relaxed text-text-secondary">
            {config.gmNote}
          </p>
        </div>
      )}

      {/* Generated timestamp */}
      {config.generatedAt && (
        <p className="text-data-xs text-text-muted">
          Generated {fmtDate(config.generatedAt)}
        </p>
      )}
    </div>
  );
}

// ── Shared ──

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border-subtle bg-surface-2 px-3 py-2">
      <p className="text-data-xs text-text-muted">{label}</p>
      <p className="font-mono text-data-sm font-semibold text-text-primary">
        {value}
      </p>
    </div>
  );
}
