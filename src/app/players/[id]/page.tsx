"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ValueGauge } from "@/components/ui/value-gauge";
import { ValueBadge } from "@/components/ui/value-badge";
import { TeamLogo } from "@/components/ui/team-logo";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";
import {
  ArrowLeft,
  Star,
  GitCompareArrows,
  FileDown,
  Info,
  Shield,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  Sparkles,
  Loader2,
  ClipboardList,
} from "lucide-react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
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
  Cell,
} from "recharts";

// ── Constants ──

const CURRENT_SEASON_START = 2025;
const CURRENT_SEASON_END = 2026;

// ── Types ──

type RouterOutput = inferRouterOutputs<AppRouter>;
type Tab = "overview" | "career" | "advanced" | "impact" | "contract" | "comparables" | "negotiation";
type Profile = RouterOutput["player"]["getProfile"];

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "career", label: "Career Stats" },
  { id: "advanced", label: "Advanced Analytics" },
  { id: "impact", label: "Impact" },
  { id: "contract", label: "Contract Intelligence" },
  { id: "comparables", label: "Comparables" },
  { id: "negotiation", label: "Negotiation Assistant" },
];

// ── Main page ──

export default function PlayerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const { data: profile, isLoading } = trpc.player.getProfile.useQuery({
    playerId: params.id,
  });

  const trackMutation = trpc.analytics.track.useMutation();
  useEffect(() => {
    if (profile) {
      trackMutation.mutate({
        eventType: "PLAYER_VIEW",
        metadata: {
          playerId: params.id,
          playerName: profile.fullName,
          teamAbbrev: profile.team?.abbreviation ?? null,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, profile?.fullName]);

  if (isLoading) return <PageSkeleton />;
  if (!profile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-text-muted">Player not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PlayerHeader profile={profile} />
      <PlayerSummary profile={profile} />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <div key={activeTab} className="animate-in fade-in duration-200">
        {activeTab === "overview" && (
          <OverviewTab playerId={params.id} profile={profile} />
        )}
        {activeTab === "career" && (
          <CareerStatsTab playerId={params.id} profile={profile} />
        )}
        {activeTab === "advanced" && (
          <AdvancedTab playerId={params.id} profile={profile} />
        )}
        {activeTab === "impact" && (
          <ImpactTab profile={profile} />
        )}
        {activeTab === "contract" && (
          <ContractTab playerId={params.id} />
        )}
        {activeTab === "comparables" && (
          <ComparablesTab playerId={params.id} profile={profile} />
        )}
        {activeTab === "negotiation" && (
          <NegotiationTab playerId={params.id} profile={profile} />
        )}
      </div>
    </div>
  );
}

// ── Player Header ──

function PlayerHeader({ profile }: { profile: Profile }) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-1 p-5">
      <Link
        href="/players"
        className="mb-3 inline-flex items-center gap-1.5 text-data-xs text-text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to Players
      </Link>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        {/* Headshot + bio */}
        <div className="flex items-center gap-4">
          <PlayerAvatar
            headshotUrl={profile.headshotUrl}
            nhlApiId={profile.nhlApiId}
            teamAbbrev={profile.team?.abbreviation}
            firstName={profile.firstName}
            lastName={profile.lastName}
            size="xl"
          />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">
              {profile.fullName}
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-data-sm text-text-muted">
              {profile.team && (
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <TeamLogo teamAbbrev={profile.team.abbreviation} size="sm" />
                  {profile.team.name}
                </span>
              )}
              <span>·</span>
              <span>{profile.position}</span>
              <span>·</span>
              <span>Age {profile.age}</span>
              {profile.shootsCatches && (
                <>
                  <span>·</span>
                  <span>Shoots {profile.shootsCatches}</span>
                </>
              )}
              {profile.heightInches && profile.weightLbs && (
                <>
                  <span>·</span>
                  <span>
                    {Math.floor(profile.heightInches / 12)}&apos;
                    {profile.heightInches % 12}&quot; · {profile.weightLbs} lbs
                  </span>
                </>
              )}
            </div>
            <div className="mt-0.5 text-data-xs text-text-muted">
              {profile.draftYear ? (
                <span>
                  {profile.draftYear} R{profile.draftRound} P{profile.draftOverall}
                  {profile.draftTeam && ` — ${profile.draftTeam.name}`}
                </span>
              ) : (
                <span>Undrafted</span>
              )}
            </div>
          </div>
        </div>

        {/* Value gauge + badge */}

        <div className="flex items-center gap-4 sm:ml-auto">
          {profile.valueScore && (
            <>
              <ValueGauge
                score={profile.valueScore.overallScore}
                size={90}
                strokeWidth={6}
              />
              <div className="space-y-1.5">
                <ValueBadge score={profile.valueScore.overallScore} />
                {profile.valueScore.leagueRank && (
                  <p className="text-data-xs text-text-muted">
                    League Rank #{profile.valueScore.leagueRank}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Action buttons */}
        <PlayerActions playerId={profile.id} playerName={profile.fullName} />
      </div>
    </div>
  );
}

function PlayerActions({ playerId, playerName }: { playerId: string; playerName: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();

  // Watch list state
  const [watchMenuOpen, setWatchMenuOpen] = useState(false);
  const { data: userLists } = trpc.watchlist.getLists.useQuery();
  const { data: playerLists } = trpc.watchlist.getPlayerWatchLists.useQuery({ playerId });
  const addToList = trpc.watchlist.addPlayer.useMutation({
    onSuccess: () => {
      utils.watchlist.getPlayerWatchLists.invalidate({ playerId });
      utils.watchlist.getLists.invalidate();
      setWatchMenuOpen(false);
    },
  });
  const removeFromList = trpc.watchlist.removePlayer.useMutation({
    onSuccess: () => {
      utils.watchlist.getPlayerWatchLists.invalidate({ playerId });
      utils.watchlist.getLists.invalidate();
    },
  });

  // Report generation
  const generateReport = trpc.report.generatePlayerReport.useMutation({
    onSuccess: () => {
      router.push("/reports");
    },
  });

  const isOnAnyList = playerLists && playerLists.length > 0;

  return (
    <div className="flex gap-2 sm:flex-col">
      {/* Watch List */}
      <div className="relative">
        <button
          onClick={() => setWatchMenuOpen(!watchMenuOpen)}
          className={cn(
            "flex items-center gap-1.5 rounded border px-3 py-1.5 text-data-xs transition-colors",
            isOnAnyList
              ? "border-accent bg-accent-muted text-accent"
              : "border-border-subtle bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary",
          )}
        >
          <Star className={cn("h-3.5 w-3.5", isOnAnyList && "fill-current")} />
          Watch List
        </button>
        {watchMenuOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-border-subtle bg-surface-2 py-1 shadow-lg">
            {userLists && userLists.length > 0 ? (
              userLists.map((list) => {
                const isOnThis = playerLists?.some((pl) => pl.id === list.id);
                return (
                  <button
                    key={list.id}
                    onClick={() => {
                      if (isOnThis) {
                        removeFromList.mutate({ watchListId: list.id, playerId });
                      } else {
                        addToList.mutate({ watchListId: list.id, playerId });
                      }
                    }}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-data-sm text-text-secondary hover:bg-surface-3"
                  >
                    <span className="truncate">{list.name}</span>
                    {isOnThis && (
                      <span className="text-data-xs text-accent">✓</span>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-2 text-data-xs text-text-muted">
                No watch lists yet
              </p>
            )}
          </div>
        )}
      </div>

      {/* Compare */}
      <button
        onClick={() => router.push(`/compare?players=${playerId}`)}
        className="flex items-center gap-1.5 rounded border border-border-subtle bg-surface-2 px-3 py-1.5 text-data-xs text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary"
      >
        <GitCompareArrows className="h-3.5 w-3.5" />
        Compare
      </button>

      {/* Generate Report */}
      <button
        onClick={() => generateReport.mutate({ playerId })}
        disabled={generateReport.isPending}
        className="flex items-center gap-1.5 rounded border border-border-subtle bg-surface-2 px-3 py-1.5 text-data-xs text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary disabled:opacity-50"
      >
        <FileDown className="h-3.5 w-3.5" />
        {generateReport.isPending ? "Generating..." : "Export"}
      </button>
    </div>
  );
}

// ── Player Summary ──

function fmtAAV(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    // Remove trailing zeros: 8.075 → "8.075", 12.5 → "12.5", 8.25 → "8.25", 1.0 → "1"
    const formatted = m.toFixed(3).replace(/\.?0+$/, "");
    return `$${formatted}M`;
  }
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

function getGradeLabel(score: number): string {
  if (score >= 85) return "Elite Value";
  if (score >= 70) return "Strong Value";
  if (score >= 55) return "Fair Value";
  if (score >= 40) return "Below Value";
  return "Overpaid";
}

function generatePlayerSummary(profile: Profile): string | null {
  const isGoalie = profile.position === "G";
  const stats = profile.stats;
  const goalieStats = profile.goalieStats;
  const contract = profile.contract;
  const vs = profile.valueScore;

  if (!vs) return null;
  if (!contract) return null;
  if (isGoalie && !goalieStats) return null;
  if (!isGoalie && !stats) return null;

  const fullName = profile.fullName;
  const age = profile.age;
  const aav = contract.aav;
  const aavStr = fmtAAV(aav);
  const overall = vs.overallScore;
  const grade = getGradeLabel(overall);
  const yearsLeft = contract.yearsRemaining;

  const components = vs.components as Record<string, { score: number; weight: number; rawValue: number; benchmark: number; label: string }>;

  // Find top 2 and bottom 2 components by score
  const sorted = Object.entries(components)
    .filter(([, c]) => c && typeof c.score === "number")
    .sort((a, b) => b[1].score - a[1].score);
  const strengths = sorted.slice(0, 2);
  const weaknesses = sorted.slice(-2).reverse();

  const sentences: string[] = [];

  // ── Sentence 1: Performance snapshot ──
  if (isGoalie && goalieStats) {
    const gs = goalieStats;
    const svPctStr = gs.savePercentage > 0 ? gs.savePercentage.toFixed(3) : null;
    const gaaStr = gs.goalsAgainstAvg > 0 ? gs.goalsAgainstAvg.toFixed(2) : null;
    const record = `${gs.wins}-${gs.losses}${gs.otLosses ? `-${gs.otLosses}` : ""}`;

    let perf = `${fullName} has posted a ${record} record`;
    if (svPctStr && gaaStr) {
      perf += ` with a ${svPctStr} save percentage and ${gaaStr} GAA`;
    }
    perf += ` across ${gs.gamesStarted ?? gs.gamesPlayed} starts this season.`;
    sentences.push(perf);
  } else if (stats) {
    const gp = stats.gamesPlayed;
    const pts = stats.points;
    const g = stats.goals;
    const ppg = gp > 0 ? (pts / gp).toFixed(2) : "0.00";

    let perf: string;
    if (pts >= 80 || (gp > 0 && pts / gp >= 1.0)) {
      perf = `${fullName} is having a dominant season with ${g} goals and ${pts} points in ${gp} games, producing at an elite ${ppg} points-per-game pace.`;
    } else if (pts >= 50 || (gp > 0 && pts / gp >= 0.7)) {
      perf = `${fullName} has been a productive contributor with ${g} goals and ${pts} points in ${gp} games (${ppg} P/GP) this season.`;
    } else if (pts >= 30 || (gp > 0 && pts / gp >= 0.4)) {
      perf = `${fullName} has recorded ${g} goals and ${pts} points in ${gp} games this season, producing at a ${ppg} points-per-game rate.`;
    } else if (gp > 0) {
      perf = `${fullName} has ${g} goals and ${pts} points through ${gp} games this season.`;
    } else {
      perf = `${fullName} has yet to appear in a game this season.`;
    }
    sentences.push(perf);
  }

  // ── Sentence 2: Contract value assessment ──
  if (isGoalie && goalieStats) {
    const gs = goalieStats;
    const svPct = gs.savePercentage;
    if (svPct >= 0.920) {
      sentences.push(`On a ${aavStr} AAV, his outstanding numbers make him one of the best goaltending values in the league.`);
    } else if (svPct >= 0.910) {
      sentences.push(`At ${aavStr} AAV, he's providing solid value between the pipes with above-average results for the investment.`);
    } else if (svPct >= 0.900) {
      sentences.push(`At ${aavStr} AAV, his numbers are roughly league average, making the return on his contract somewhat modest.`);
    } else {
      sentences.push(`At ${aavStr} AAV, his sub-.900 save percentage represents a significant underperformance relative to his cap hit.`);
    }
  } else if (stats) {
    const pts = stats.points;
    const gp = stats.gamesPlayed;
    const costPerPt = gp > 0 && pts > 0 ? aav / pts : null;

    if (overall >= 85) {
      sentences.push(`On a ${aavStr} AAV, his production far exceeds what you'd expect at that cap hit, making him one of the best values in the league.`);
    } else if (overall >= 70) {
      sentences.push(`At ${aavStr} AAV, he's comfortably outperforming his contract and providing real surplus value to his team.`);
    } else if (overall >= 55) {
      sentences.push(`His ${aavStr} AAV is roughly in line with his on-ice output — he's earning his money without significant surplus or deficit.`);
    } else if (overall >= 40) {
      if (costPerPt && costPerPt > 200_000) {
        sentences.push(`At ${aavStr} AAV, his production hasn't matched the investment, with a cost-per-point that ranks among the league's steeper values.`);
      } else {
        sentences.push(`His ${aavStr} AAV is difficult to justify given his current production level, creating a negative value gap.`);
      }
    } else {
      sentences.push(`At ${aavStr} AAV, he's one of the more expensive underperformers at his position, with output that falls well short of his cap hit.`);
    }
  }

  // ── Sentence 3: Value score drivers ──
  const strengthLabels = strengths.map(([, c]) => c.label.toLowerCase());
  const weaknessLabels = weaknesses.map(([, c]) => c.label.toLowerCase());

  if (overall >= 70 && strengths.length >= 2) {
    sentences.push(`His ${grade.toLowerCase()} rating of ${overall} is driven by standout ${strengthLabels[0]} and ${strengthLabels[1]} scores.`);
  } else if (overall >= 55 && strengths.length >= 1) {
    sentences.push(`His ${grade.toLowerCase()} rating of ${overall} reflects solid ${strengthLabels[0]}${weaknesses.length > 0 && weaknesses[0][1].score < 40 ? `, though ${weaknessLabels[0]} is an area of concern` : ""}.`);
  } else if (overall < 55 && weaknesses.length >= 2) {
    sentences.push(`His ${grade.toLowerCase()} rating of ${overall} is weighed down by low ${weaknessLabels[0]} and ${weaknessLabels[1]} marks.`);
  } else {
    sentences.push(`He carries a ${grade.toLowerCase()} rating of ${overall}.`);
  }

  // ── Sentence 4: Context (age, contract situation, notable details) ──
  const contextParts: string[] = [];

  if (age <= 23 && vs.positionGroup !== "G") {
    if (overall >= 60) {
      contextParts.push(`at just ${age}, he's on an upward trajectory with his best hockey likely still ahead`);
    } else {
      contextParts.push(`at ${age}, he still has time to develop into the player his contract projects`);
    }
  } else if (age >= 33) {
    if (overall >= 60) {
      contextParts.push(`at ${age}, he's defying the typical age curve and still producing at a high level`);
    } else {
      contextParts.push(`at ${age}, the aging curve is becoming a factor in his declining production`);
    }
  }

  if (yearsLeft === 0) {
    contextParts.push("his contract expires after this season, making him a pending UFA");
  } else if (yearsLeft === 1) {
    contextParts.push("with just one year remaining on his deal, his next contract will be a key decision");
  } else if (yearsLeft >= 5) {
    contextParts.push(`he's locked in through ${contract.endYear} with ${yearsLeft} years remaining`);
  }

  if (contract.hasNMC) {
    contextParts.push("he holds a full no-movement clause");
  } else if (contract.hasNTC) {
    contextParts.push("his contract includes a no-trade clause");
  }

  if (isGoalie && goalieStats) {
    if (goalieStats.highDangerSavePct != null) {
      if (goalieStats.highDangerSavePct >= 0.850) {
        contextParts.push(`his ${(goalieStats.highDangerSavePct * 100).toFixed(1)}% high-danger save percentage shows elite shot-stopping ability`);
      } else if (goalieStats.highDangerSavePct < 0.800) {
        contextParts.push(`his ${(goalieStats.highDangerSavePct * 100).toFixed(1)}% high-danger save percentage suggests the issues go beyond team defense`);
      }
    }
    if (goalieStats.shutouts && goalieStats.shutouts >= 4) {
      contextParts.push(`he's recorded ${goalieStats.shutouts} shutouts`);
    }
  }

  if (contextParts.length > 0) {
    const joined = contextParts[0].charAt(0).toUpperCase() + contextParts[0].slice(1);
    if (contextParts.length === 1) {
      sentences.push(`${joined}.`);
    } else {
      sentences.push(`${joined}, and ${contextParts.slice(1).join(", ")}.`);
    }
  }

  return sentences.join(" ");
}

function PlayerSummary({ profile }: { profile: Profile }) {
  const summary = generatePlayerSummary(profile);
  if (!summary) return null;

  return (
    <div className="rounded-md border border-border-subtle bg-surface-0 p-4">
      <div className="mb-2 flex items-center gap-2">
        <ClipboardList className="h-3.5 w-3.5 text-accent" />
        <span className="text-data-xs font-semibold uppercase tracking-wider text-accent">
          Scouting Report
        </span>
      </div>
      <p className="text-data-sm leading-relaxed text-text-secondary">
        {summary}
      </p>
    </div>
  );
}

// ── Tab Bar ──

function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
}) {
  return (
    <div className="flex gap-1 rounded-md border border-border-subtle bg-surface-1 p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
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
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 1: Overview
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function OverviewTab({
  playerId,
  profile,
}: {
  playerId: string;
  profile: Profile;
}) {
  const { data: history } = trpc.player.getHistory.useQuery({ playerId });
  const isGoalie = profile.position === "G";
  const { data: goalieData } = trpc.player.getGoalieAnalytics.useQuery(
    { playerId },
    { enabled: isGoalie },
  );

  return (
    <div className="space-y-6">
      {/* Contract Summary + Cost Efficiency */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ContractSummaryCard profile={profile} />
        <CostEfficiencyCard profile={profile} />
      </div>

      {/* Season Stat Grid */}
      <SeasonStatGrid profile={profile} />

      {/* Goalie-specific sections */}
      {isGoalie && goalieData && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <GoalieDangerZoneChart data={goalieData.dangerZoneData} />
            <GoalieGSAxTrend data={goalieData.gsaxTrend} />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <GoalieWorkloadAnalysis data={goalieData.workloadData} isStarter={goalieData.isStarter} />
            {goalieData.creaseShare && (
              <GoalieCreaseShare data={goalieData.creaseShare} />
            )}
          </div>
          {goalieData.aavBenchmark && goalieData.aavBenchmark.length > 0 && (
            <GoalieBenchmarkComparison
              playerName={profile.fullName}
              playerStats={profile.goalieStats}
              benchmarks={goalieData.aavBenchmark}
            />
          )}
        </>
      )}

      {/* Radar + Trajectory */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PerformanceRadar profile={profile} />
        <ProductionTrajectory history={history ?? []} />
      </div>
    </div>
  );
}

function ContractSummaryCard({ profile }: { profile: Profile }) {
  const c = profile.contract;
  if (!c) {
    return (
      <Card title="Contract Summary">
        <p className="py-6 text-center text-data-sm text-text-muted">
          No contract data available
        </p>
      </Card>
    );
  }

  return (
    <Card title="Contract Summary" icon={Shield}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <StatRow label="AAV" value={fmtCap(c.aav)} tip="Average Annual Value — total contract value divided by contract length" />
        <StatRow label="Total Value" value={fmtCap(c.totalValue)} tip="Total guaranteed contract value" />
        <StatRow label="Term" value={`${c.totalYears} years`} tip="Total contract length in years" />
        <StatRow label="Remaining" value={`${c.yearsRemaining} yr${c.yearsRemaining !== 1 ? "s" : ""}`} tip="Years remaining before contract expires" />
        <StatRow label="Structure" value={c.structure.replace(/_/g, " ")} tip="How the cap hit is distributed across years" />
        <StatRow label="Signing Type" value={c.signingType ?? "—"} tip="Contract type: RFA, UFA, ELC, or Extension" />
        <div className="col-span-2 flex gap-3 pt-1">
          <span
            className={cn(
              "rounded px-2 py-0.5 text-data-xs font-medium",
              c.hasNMC
                ? "bg-danger-muted text-danger"
                : "bg-surface-2 text-text-muted",
            )}
          >
            <Tip text="No-Movement Clause — player cannot be placed on waivers or traded without consent">
              NMC {c.hasNMC ? "✓" : "✗"}
            </Tip>
          </span>
          <span
            className={cn(
              "rounded px-2 py-0.5 text-data-xs font-medium",
              c.hasNTC
                ? "bg-warning-muted text-warning"
                : "bg-surface-2 text-text-muted",
            )}
          >
            <Tip text="No-Trade Clause — player can block trades to certain teams">
              NTC {c.hasNTC ? "✓" : "✗"}
            </Tip>
          </span>
        </div>
      </div>
    </Card>
  );
}

function CostEfficiencyCard({ profile }: { profile: Profile }) {
  const v = profile.valueScore;
  if (!v) {
    return (
      <Card title="Cost Efficiency">
        <p className="py-6 text-center text-data-sm text-text-muted">
          No value score calculated
        </p>
      </Card>
    );
  }

  return (
    <Card title="Cost Efficiency" icon={BarChart3}>
      <div className="space-y-4">
        <EfficiencyRow
          label="Cost Per Point"
          value={v.costPerPoint ? fmtCap(v.costPerPoint) : "—"}
          tip="Dollars spent per point produced (82-game pace)"
        />
        <EfficiencyRow
          label="Cost Per Goal"
          value={v.costPerGoal ? fmtCap(v.costPerGoal) : "—"}
          tip="Dollars spent per goal scored (82-game pace)"
        />
        <EfficiencyRow
          label="Cost Per WAR"
          value={v.costPerWAR ? fmtCap(v.costPerWAR) : "—"}
          tip="Dollars spent per Win Above Replacement"
        />
        <EfficiencyRow
          label="Estimated WAR"
          value={v.estimatedWAR?.toFixed(1) ?? "—"}
          tip="Wins Above Replacement — estimated total value in wins contributed"
        />
        <div className="border-t border-border-subtle pt-3">
          <div className="flex items-center justify-between">
            <span className="text-data-xs text-text-muted">
              {v.aavTier} · {v.positionGroup} ·{" "}
              {v.peerRank ? `Peer #${v.peerRank}` : "—"}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function EfficiencyRow({
  label,
  value,
  tip,
}: {
  label: string;
  value: string;
  tip: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <Tip text={tip}>
        <span className="text-data-sm text-text-secondary">{label}</span>
      </Tip>
      <span className="font-mono text-data-sm font-semibold text-text-primary">
        {value}
      </span>
    </div>
  );
}

function SeasonStatGrid({ profile }: { profile: Profile }) {
  const s = profile.stats;
  const g = profile.goalieStats;
  const isGoalie = profile.position === "G";

  if (isGoalie && g) {
    return (
      <Card title="Season Stats">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-10">
          <StatCell label="GP" value={g.gamesPlayed} tip="Games played" />
          <StatCell label="GS" value={g.gamesStarted} tip="Games started" />
          <StatCell label="W" value={g.wins} tip="Wins" />
          <StatCell label="L" value={g.losses} tip="Losses" />
          <StatCell label="OTL" value={g.otLosses} tip="Overtime losses" />
          <StatCell label="SV%" value={g.savePercentage.toFixed(3)} tip="Save percentage — saves divided by shots against" />
          <StatCell label="GAA" value={g.goalsAgainstAvg.toFixed(2)} tip="Goals Against Average per 60 minutes" />
          <StatCell label="SO" value={g.shutouts} tip="Shutouts" />
          <StatCell label="SA" value={g.shotsAgainst} tip="Shots against" />
          <StatCell label="SV" value={g.saves} tip="Total saves" />
        </div>
      </Card>
    );
  }

  if (!s) {
    return (
      <Card title="Season Stats">
        <p className="py-6 text-center text-data-sm text-text-muted">
          No stats available for this season
        </p>
      </Card>
    );
  }

  return (
    <Card title="Season Stats">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-10">
        <StatCell label="GP" value={s.gamesPlayed} tip="Games played this season" />
        <StatCell label="G" value={s.goals} tip="Goals scored" />
        <StatCell label="A" value={s.assists} tip="Assists" />
        <StatCell label="PTS" value={s.points} tip="Total points (goals + assists)" />
        <StatCell label="+/−" value={s.plusMinus > 0 ? `+${s.plusMinus}` : s.plusMinus} tip="Plus/minus — on-ice goal differential at even strength" />
        <StatCell label="PIM" value={s.pim} tip="Penalty minutes" />
        <StatCell label="TOI" value={s.toiPerGame.toFixed(1)} tip="Average time on ice per game (minutes)" />
        <StatCell label="SH%" value={`${s.shootingPct.toFixed(1)}%`} tip="Shooting percentage — goals divided by shots on goal" />
        <StatCell label="PP PTS" value={s.powerPlayPoints} tip="Power play points" />
        <StatCell label="SHOTS" value={s.shots} tip="Total shots on goal" />
      </div>
    </Card>
  );
}

function PerformanceRadar({ profile }: { profile: Profile }) {
  const v = profile.valueScore;
  if (!v?.components) {
    return (
      <Card title="Performance Radar">
        <p className="py-10 text-center text-data-sm text-text-muted">
          No value data available
        </p>
      </Card>
    );
  }

  const comp = v.components;
  const radarData = Object.entries(comp).map(([, c]) => ({
    subject: c.label.replace(" Per $M", "/$M").replace(" Above Expected", " AbvExp"),
    value: c.score,
    fullMark: 100,
  }));

  return (
    <Card title="Performance Radar">
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 10, fill: "#64748b" }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: "#64748b" }}
            tickCount={5}
          />
          <Radar
            dataKey="value"
            stroke="#dc2626"
            fill="#dc2626"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function ProductionTrajectory({
  history,
}: {
  history: Array<{
    seasonLabel: string;
    points: number;
    aav: number | null;
  }>;
}) {
  if (history.length < 2) {
    return (
      <Card title="Production Trajectory">
        <p className="py-10 text-center text-data-sm text-text-muted">
          Not enough historical data
        </p>
      </Card>
    );
  }

  const data = history.slice(-4).map((h) => ({
    season: h.seasonLabel,
    points: h.points,
    aav: h.aav ? h.aav / 1_000_000 : null,
  }));

  return (
    <Card title="Production Trajectory">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="season"
            tick={{ fontSize: 10, fill: "#64748b" }}
          />
          <YAxis
            yAxisId="pts"
            tick={{ fontSize: 10, fill: "#64748b" }}
            label={{
              value: "Points",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 10, fill: "#64748b" },
            }}
          />
          <YAxis
            yAxisId="aav"
            orientation="right"
            tick={{ fontSize: 10, fill: "#64748b" }}
            label={{
              value: "AAV ($M)",
              angle: 90,
              position: "insideRight",
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
          />
          <Legend wrapperStyle={{ fontSize: "0.7rem" }} />
          <Line
            yAxisId="pts"
            type="monotone"
            dataKey="points"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Points"
          />
          <Line
            yAxisId="aav"
            type="monotone"
            dataKey="aav"
            stroke="#a78bfa"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 4 }}
            name="AAV ($M)"
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 2: Career Stats
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type CareerData = RouterOutput["player"]["getCareerStats"];

function CareerStatsTab({
  playerId,
  profile,
}: {
  playerId: string;
  profile: Profile;
}) {
  const { data, isLoading } = trpc.player.getCareerStats.useQuery({ playerId });
  const { data: contracts } = trpc.player.getContractHistory.useQuery({ playerId });
  const [sortCol, setSortCol] = useState<string>("season");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [contractFilter, setContractFilter] = useState<string>("all");

  if (isLoading) return <TabSkeleton />;
  if (!data) return null;

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const isGoalie = data.type === "goalie";

  // Build contract filter options
  const contractOptions = (contracts ?? []).map((c) => ({
    id: c.id,
    label: `${c.startYear}–${String(c.endYear).slice(2)} (${fmtCap(c.aav)})`,
    startYear: c.startYear,
    endYear: c.endYear,
  }));

  return (
    <div className="space-y-6">
      {/* Contract filter dropdown */}
      {contractOptions.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-data-xs text-text-muted">Filter by contract:</label>
          <select
            value={contractFilter}
            onChange={(e) => setContractFilter(e.target.value)}
            className="rounded border border-border-subtle bg-surface-2 px-3 py-1.5 text-data-sm text-text-primary"
          >
            <option value="all">All Seasons</option>
            {contractOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {isGoalie ? (
        <GoalieCareerTable
          seasons={data.goalieSeasons}
          sortCol={sortCol}
          sortDir={sortDir}
          onSort={handleSort}
          contractFilter={contractFilter}
          contracts={contractOptions}
        />
      ) : (
        <SkaterCareerTable
          seasons={data.skaterSeasons}
          sortCol={sortCol}
          sortDir={sortDir}
          onSort={handleSort}
          contractFilter={contractFilter}
          contracts={contractOptions}
        />
      )}
    </div>
  );
}

type ContractFilterOption = { id: string; label: string; startYear: number; endYear: number };

function seasonInContract(
  season: string,
  contractId: string,
  contracts: ContractFilterOption[],
): boolean {
  if (contractId === "all") return true;
  const c = contracts.find((x) => x.id === contractId);
  if (!c) return true;
  const seasonStart = parseInt(season.substring(0, 4));
  return seasonStart >= c.startYear && seasonStart < c.endYear;
}

// ── Sortable table header ──
function SortHeader({
  label,
  col,
  sortCol,
  sortDir,
  onSort,
  align,
}: {
  label: string;
  col: string;
  sortCol: string;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
  align?: "left" | "right";
}) {
  const active = sortCol === col;
  return (
    <th
      onClick={() => onSort(col)}
      className={cn(
        "cursor-pointer select-none whitespace-nowrap px-2 py-2 text-data-xs font-medium uppercase tracking-wider text-text-muted hover:text-text-secondary",
        align === "left" ? "text-left" : "text-right",
      )}
    >
      {label}
      {active && (
        <span className="ml-0.5 text-accent">{sortDir === "asc" ? "▲" : "▼"}</span>
      )}
    </th>
  );
}

type SkaterSeason = CareerData["skaterSeasons"][number];

function SkaterCareerTable({
  seasons,
  sortCol,
  sortDir,
  onSort,
  contractFilter,
  contracts,
}: {
  seasons: SkaterSeason[];
  sortCol: string;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
  contractFilter: string;
  contracts: ContractFilterOption[];
}) {
  const filtered = seasons.filter((s) =>
    seasonInContract(s.season, contractFilter, contracts),
  );

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortCol as keyof SkaterSeason] ?? 0;
    const bv = b[sortCol as keyof SkaterSeason] ?? 0;
    if (typeof av === "string" && typeof bv === "string")
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  // Career totals
  const totals = filtered.reduce(
    (acc, s) => ({
      gp: acc.gp + s.gp,
      g: acc.g + s.g,
      a: acc.a + s.a,
      pts: acc.pts + s.pts,
      pm: acc.pm + s.pm,
      pim: acc.pim + s.pim,
      shots: acc.shots + s.shots,
      ppg: acc.ppg + s.ppg,
      ppa: acc.ppa + s.ppa,
      ppPts: acc.ppPts + s.ppPts,
      shg: acc.shg + s.shg,
      shPts: acc.shPts + s.shPts,
      hits: acc.hits + s.hits,
      blk: acc.blk + s.blk,
      toiSum: acc.toiSum + s.toi * s.gp,
    }),
    { gp: 0, g: 0, a: 0, pts: 0, pm: 0, pim: 0, shots: 0, ppg: 0, ppa: 0, ppPts: 0, shg: 0, shPts: 0, hits: 0, blk: 0, toiSum: 0 },
  );
  const avgToi = totals.gp > 0 ? totals.toiSum / totals.gp : 0;
  const shPct = totals.shots > 0 ? (totals.g / totals.shots) * 100 : 0;

  const cols: { key: string; label: string; align?: "left" | "right" }[] = [
    { key: "season", label: "Season", align: "left" },
    { key: "teamAbbrev", label: "Team", align: "left" },
    { key: "gp", label: "GP" },
    { key: "g", label: "G" },
    { key: "a", label: "A" },
    { key: "pts", label: "PTS" },
    { key: "pm", label: "+/−" },
    { key: "pim", label: "PIM" },
    { key: "toi", label: "TOI" },
    { key: "shots", label: "S" },
    { key: "shPct", label: "SH%" },
    { key: "ppg", label: "PPG" },
    { key: "ppa", label: "PPA" },
    { key: "ppPts", label: "PPP" },
    { key: "shg", label: "SHG" },
    { key: "shPts", label: "SHP" },
    { key: "hits", label: "HIT" },
    { key: "blk", label: "BLK" },
  ];

  return (
    <Card title={contractFilter !== "all" ? "Contract Period Stats" : "Career Stats"} icon={BarChart3}>
      {contractFilter !== "all" && filtered.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3 rounded border border-border-subtle bg-surface-2 p-3 sm:grid-cols-6">
          <div className="text-center">
            <p className="text-data-xs text-text-muted">Seasons</p>
            <p className="font-mono text-data-sm font-semibold text-text-primary">{filtered.length}</p>
          </div>
          <div className="text-center">
            <p className="text-data-xs text-text-muted">GP</p>
            <p className="font-mono text-data-sm font-semibold text-text-primary">{totals.gp}</p>
          </div>
          <div className="text-center">
            <p className="text-data-xs text-text-muted">G</p>
            <p className="font-mono text-data-sm font-semibold text-text-primary">{totals.g}</p>
          </div>
          <div className="text-center">
            <p className="text-data-xs text-text-muted">A</p>
            <p className="font-mono text-data-sm font-semibold text-text-primary">{totals.a}</p>
          </div>
          <div className="text-center">
            <p className="text-data-xs text-text-muted">PTS</p>
            <p className="font-mono text-data-sm font-semibold text-text-primary">{totals.pts}</p>
          </div>
          <div className="text-center">
            <p className="text-data-xs text-text-muted">PTS/GP</p>
            <p className="font-mono text-data-sm font-semibold text-text-primary">
              {totals.gp > 0 ? (totals.pts / totals.gp).toFixed(2) : "—"}
            </p>
          </div>
        </div>
      )}
      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border-subtle">
              {cols.map((c) => (
                <SortHeader
                  key={c.key}
                  label={c.label}
                  col={c.key}
                  sortCol={sortCol}
                  sortDir={sortDir}
                  onSort={onSort}
                  align={c.align}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr
                key={s.season}
                className="border-b border-border-subtle/50 hover:bg-surface-2/50"
              >
                <td className="whitespace-nowrap px-2 py-1.5 text-data-sm text-text-primary">{s.seasonLabel}</td>
                <td className="px-2 py-1.5 text-data-sm text-text-secondary">{s.teamAbbrev}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-primary">{s.gp}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-primary">{s.g}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-primary">{s.a}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm font-semibold text-text-primary">{s.pts}</td>
                <td className={cn("px-2 py-1.5 text-right font-mono text-data-sm", s.pm > 0 ? "text-success" : s.pm < 0 ? "text-danger" : "text-text-muted")}>
                  {s.pm > 0 ? `+${s.pm}` : s.pm}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-muted">{s.pim}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-secondary">{s.toi.toFixed(1)}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-muted">{s.shots}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-muted">{s.shPct.toFixed(1)}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-muted">{s.ppg}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-muted">{s.ppa}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-muted">{s.ppPts}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-muted">{s.shg}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-muted">{s.shPts}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-muted">{s.hits}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-muted">{s.blk}</td>
              </tr>
            ))}
            {/* Career totals row */}
            <tr className="border-t-2 border-border-subtle bg-surface-2/50 font-semibold">
              <td className="px-2 py-2 text-data-sm text-text-primary" colSpan={2}>
                {contractFilter !== "all" ? "Contract Total" : "Career Total"}
              </td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-primary">{totals.gp}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-primary">{totals.g}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-primary">{totals.a}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-primary">{totals.pts}</td>
              <td className={cn("px-2 py-2 text-right font-mono text-data-sm", totals.pm > 0 ? "text-success" : totals.pm < 0 ? "text-danger" : "text-text-muted")}>
                {totals.pm > 0 ? `+${totals.pm}` : totals.pm}
              </td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-muted">{totals.pim}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-secondary">{avgToi.toFixed(1)}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-muted">{totals.shots}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-muted">{shPct.toFixed(1)}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-muted">{totals.ppg}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-muted">{totals.ppa}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-muted">{totals.ppPts}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-muted">{totals.shg}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-muted">{totals.shPts}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-muted">{totals.hits}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-muted">{totals.blk}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

type GoalieSeason = CareerData["goalieSeasons"][number];

function GoalieCareerTable({
  seasons,
  sortCol,
  sortDir,
  onSort,
  contractFilter,
  contracts,
}: {
  seasons: GoalieSeason[];
  sortCol: string;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
  contractFilter: string;
  contracts: ContractFilterOption[];
}) {
  const filtered = seasons.filter((s) =>
    seasonInContract(s.season, contractFilter, contracts),
  );

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortCol as keyof GoalieSeason] ?? 0;
    const bv = b[sortCol as keyof GoalieSeason] ?? 0;
    if (typeof av === "string" && typeof bv === "string")
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  const totals = filtered.reduce(
    (acc, s) => ({
      gp: acc.gp + s.gp,
      gs: acc.gs + s.gs,
      w: acc.w + s.w,
      l: acc.l + s.l,
      otl: acc.otl + s.otl,
      so: acc.so + s.so,
      sa: acc.sa + s.sa,
      sv: acc.sv + s.sv,
    }),
    { gp: 0, gs: 0, w: 0, l: 0, otl: 0, so: 0, sa: 0, sv: 0 },
  );
  const careerSvPct = totals.sa > 0 ? totals.sv / totals.sa : 0;
  const careerGaa = totals.gp > 0 ? ((totals.sa - totals.sv) * 60) / (totals.gp * 60) : 0;

  const cols: { key: string; label: string; align?: "left" | "right" }[] = [
    { key: "season", label: "Season", align: "left" },
    { key: "teamAbbrev", label: "Team", align: "left" },
    { key: "gp", label: "GP" },
    { key: "gs", label: "GS" },
    { key: "w", label: "W" },
    { key: "l", label: "L" },
    { key: "otl", label: "OTL" },
    { key: "svPct", label: "SV%" },
    { key: "gaa", label: "GAA" },
    { key: "so", label: "SO" },
    { key: "sa", label: "SA" },
    { key: "sv", label: "SV" },
  ];

  return (
    <Card title={contractFilter !== "all" ? "Contract Period Stats" : "Career Stats"} icon={BarChart3}>
      {contractFilter !== "all" && filtered.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3 rounded border border-border-subtle bg-surface-2 p-3 sm:grid-cols-6">
          <div className="text-center">
            <p className="text-data-xs text-text-muted">Seasons</p>
            <p className="font-mono text-data-sm font-semibold text-text-primary">{filtered.length}</p>
          </div>
          <div className="text-center">
            <p className="text-data-xs text-text-muted">Record</p>
            <p className="font-mono text-data-sm font-semibold text-text-primary">{totals.w}-{totals.l}-{totals.otl}</p>
          </div>
          <div className="text-center">
            <p className="text-data-xs text-text-muted">GP</p>
            <p className="font-mono text-data-sm font-semibold text-text-primary">{totals.gp}</p>
          </div>
          <div className="text-center">
            <p className="text-data-xs text-text-muted">SV%</p>
            <p className="font-mono text-data-sm font-semibold text-text-primary">{careerSvPct.toFixed(3)}</p>
          </div>
          <div className="text-center">
            <p className="text-data-xs text-text-muted">GAA</p>
            <p className="font-mono text-data-sm font-semibold text-text-primary">{careerGaa.toFixed(2)}</p>
          </div>
          <div className="text-center">
            <p className="text-data-xs text-text-muted">SO</p>
            <p className="font-mono text-data-sm font-semibold text-text-primary">{totals.so}</p>
          </div>
        </div>
      )}
      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border-subtle">
              {cols.map((c) => (
                <SortHeader
                  key={c.key}
                  label={c.label}
                  col={c.key}
                  sortCol={sortCol}
                  sortDir={sortDir}
                  onSort={onSort}
                  align={c.align}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr
                key={s.season}
                className="border-b border-border-subtle/50 hover:bg-surface-2/50"
              >
                <td className="whitespace-nowrap px-2 py-1.5 text-data-sm text-text-primary">{s.seasonLabel}</td>
                <td className="px-2 py-1.5 text-data-sm text-text-secondary">{s.teamAbbrev}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-primary">{s.gp}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-muted">{s.gs}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-success">{s.w}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-danger">{s.l}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-muted">{s.otl}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm font-semibold text-text-primary">{s.svPct.toFixed(3)}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-secondary">{s.gaa.toFixed(2)}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-muted">{s.so}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-muted">{s.sa}</td>
                <td className="px-2 py-1.5 text-right font-mono text-data-sm text-text-muted">{s.sv}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-border-subtle bg-surface-2/50 font-semibold">
              <td className="px-2 py-2 text-data-sm text-text-primary" colSpan={2}>
                {contractFilter !== "all" ? "Contract Total" : "Career Total"}
              </td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-primary">{totals.gp}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-muted">{totals.gs}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-success">{totals.w}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-danger">{totals.l}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-muted">{totals.otl}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm font-semibold text-text-primary">{careerSvPct.toFixed(3)}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-secondary">{careerGaa.toFixed(2)}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-muted">{totals.so}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-muted">{totals.sa}</td>
              <td className="px-2 py-2 text-right font-mono text-data-sm text-text-muted">{totals.sv}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 3: Advanced Analytics
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AdvancedTab({
  playerId,
  profile,
}: {
  playerId: string;
  profile: Profile;
}) {
  const { data, isLoading } = trpc.player.getAdvancedStats.useQuery({
    playerId,
  });

  if (isLoading) return <TabSkeleton />;

  if (profile.position === "G") {
    return (
      <div className="space-y-6">
        <Card title="Goalie Analytics">
          <p className="py-6 text-center text-data-sm text-text-muted">
            Advanced goalie metrics are shown in the Overview tab.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 5v5 Section */}
      <FiveOnFiveSection data={data} />

      {/* Special Teams + Shooting */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SpecialTeamsSection data={data} />
        <ShootingProfileSection data={data} />
      </div>

      {/* Aggregate Value + Zone Starts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AggregateValueSection profile={profile} />
        <ZoneStartsSection data={data} />
      </div>
    </div>
  );
}

type AdvancedData = RouterOutput["player"]["getAdvancedStats"] | undefined;

function FiveOnFiveSection({ data }: { data: AdvancedData }) {
  const a = data?.advanced;
  const st = data?.specialTeams;

  const evPts = st
    ? st.evenStrengthGoals + st.evenStrengthAssists
    : null;

  const metrics = [
    { label: "EV Points", value: evPts, fmt: (v: number) => String(v), tip: "Even-strength points scored" },
    { label: "CF%", value: a?.corsiForPct, fmt: fmtPct, tip: "Corsi For % — shot attempt share when on ice at 5v5. Above 52% is strong", thresholds: [49, 52] },
    { label: "FF%", value: a?.fenwickForPct, fmt: fmtPct, tip: "Fenwick For % — unblocked shot attempt share at 5v5", thresholds: [49, 52] },
    { label: "xGF%", value: a?.xGFPct, fmt: fmtPct, tip: "Expected Goals For % — predicted goal share based on shot quality at 5v5", thresholds: [49, 52] },
    { label: "GF%", value: a?.goalsForPct, fmt: fmtPct, tip: "Goals For % — actual goal share when on ice at 5v5", thresholds: [49, 52] },
    { label: "Rel CF%", value: a?.relCorsiForPct, fmt: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`, tip: "Relative Corsi For % — CF% compared to team average when player is off ice" },
  ];

  return (
    <Card title="5v5 Even Strength">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((m) => (
          <div key={m.label} className="text-center">
            <Tip text={m.tip}>
              <span className="text-data-xs uppercase tracking-wider text-text-muted">
                {m.label}
              </span>
            </Tip>
            <p
              className={cn(
                "mt-1 font-mono text-lg font-bold tabular-nums",
                m.thresholds && m.value != null
                  ? getPctColor(m.value, m.thresholds[0], m.thresholds[1])
                  : "text-text-primary",
              )}
            >
              {m.value != null ? m.fmt(m.value) : "—"}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SpecialTeamsSection({ data }: { data: AdvancedData }) {
  const st = data?.specialTeams;
  if (!st) {
    return (
      <Card title="Special Teams">
        <p className="py-6 text-center text-data-sm text-text-muted">
          No data available
        </p>
      </Card>
    );
  }

  return (
    <Card title="Special Teams">
      <div className="space-y-4">
        <div>
          <h4 className="text-data-xs font-medium uppercase tracking-wider text-info">
            Power Play
          </h4>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <MiniStat label="PP Goals" value={st.powerPlayGoals} tip="Goals scored on the power play" />
            <MiniStat label="PP Assists" value={st.powerPlayAssists} tip="Assists on the power play" />
            <MiniStat label="PP Points" value={st.powerPlayPoints} tip="Total power play points" />
          </div>
          {st.powerPlayToi != null && (
            <p className="mt-1 text-data-xs text-text-muted">
              PP TOI: {st.powerPlayToi.toFixed(1)} min/gm
            </p>
          )}
        </div>
        <div className="border-t border-border-subtle pt-4">
          <h4 className="text-data-xs font-medium uppercase tracking-wider text-warning">
            Penalty Kill
          </h4>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <MiniStat label="SH Goals" value={st.shortHandedGoals} tip="Short-handed goals scored" />
            <MiniStat label="SH Assists" value={st.shortHandedAssists} tip="Short-handed assists" />
            <MiniStat label="SH Points" value={st.shortHandedPoints} tip="Total short-handed points" />
          </div>
          {st.shortHandedToi != null && (
            <p className="mt-1 text-data-xs text-text-muted">
              PK TOI: {st.shortHandedToi.toFixed(1)} min/gm
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function ShootingProfileSection({ data }: { data: AdvancedData }) {
  const sh = data?.shooting;
  if (!sh) {
    return (
      <Card title="Shooting Profile">
        <p className="py-6 text-center text-data-sm text-text-muted">
          No data available
        </p>
      </Card>
    );
  }

  return (
    <Card title="Shooting Profile">
      <div className="grid grid-cols-2 gap-4">
        <MiniStat label="Shots" value={sh.shots} tip="Total shots on goal" />
        <MiniStat label="SH%" value={`${sh.shootingPct.toFixed(1)}%`} tip="Shooting percentage — goals divided by shots on goal" />
        <MiniStat label="ixG" value={sh.ixG?.toFixed(1) ?? "—"} tip="Individual Expected Goals — predicted goals based on shot quality" />
        <MiniStat label="iHDCF" value={sh.iHDCF ?? "—"} tip="Individual High-Danger Chances For — scoring chances from the inner slot" />
        <MiniStat
          label="G/GP"
          value={
            sh.gamesPlayed > 0
              ? (sh.goals / sh.gamesPlayed).toFixed(2)
              : "—"
          }
          tip="Goals per game played"
        />
        <MiniStat
          label="Sh/GP"
          value={
            sh.gamesPlayed > 0
              ? (sh.shots / sh.gamesPlayed).toFixed(1)
              : "—"
          }
          tip="Shots per game played"
        />
      </div>
    </Card>
  );
}

function AggregateValueSection({ profile }: { profile: Profile }) {
  const v = profile.valueScore;

  return (
    <Card title="Aggregate Value">
      <div className="grid grid-cols-2 gap-4">
        <MiniStat
          label="Est. WAR"
          value={v?.estimatedWAR?.toFixed(1) ?? "—"}
          tip="Wins Above Replacement — estimated total value in wins contributed above a replacement-level player"
        />
        <MiniStat
          label="$/WAR"
          value={v?.costPerWAR ? fmtCap(v.costPerWAR) : "—"}
          tip="Dollars spent per Win Above Replacement — lower is better"
        />
        <MiniStat
          label="Value Score"
          value={v?.overallScore ?? "—"}
          tip="Composite value score from 1-99 measuring contract value"
        />
        <MiniStat
          label="Grade"
          value={v?.grade ?? "—"}
          tip="Letter grade based on value score tier"
        />
      </div>
    </Card>
  );
}

function ZoneStartsSection({ data }: { data: AdvancedData }) {
  const a = data?.advanced;
  const oz = a?.offensiveZoneStartPct;
  const dz = a?.defensiveZoneStartPct;

  return (
    <Card title="Zone Starts">
      {oz != null && dz != null ? (
        <div className="space-y-4 py-2">
          <ZoneBar label="OZ%" value={oz} color="#10b981" tip="Offensive Zone Start % — percentage of faceoffs taken in the offensive zone" />
          <ZoneBar label="DZ%" value={dz} color="#ef4444" tip="Defensive Zone Start % — percentage of faceoffs taken in the defensive zone" />
          <p className="text-data-xs text-text-muted">
            {oz > 55
              ? "Deployed primarily in offensive situations"
              : oz < 45
                ? "Heavy defensive zone deployment — trusted in own end"
                : "Balanced zone deployment"}
          </p>
        </div>
      ) : (
        <p className="py-6 text-center text-data-sm text-text-muted">
          No zone start data available
        </p>
      )}
    </Card>
  );
}

function ZoneBar({
  label,
  value,
  color,
  tip,
}: {
  label: string;
  value: number;
  color: string;
  tip: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Tip text={tip}>
          <span className="text-data-xs text-text-muted">{label}</span>
        </Tip>
        <span className="font-mono text-data-sm font-semibold text-text-primary">
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab: Impact
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ImpactTab({ profile }: { profile: Profile }) {
  const imp = profile.impactStats;
  const isGoalie = profile.position === "G";

  if (!imp) {
    return (
      <Card title="Win Impact">
        <p className="py-10 text-center text-data-sm text-text-muted">
          No impact data available yet. Impact stats are calculated from game-by-game data.
        </p>
      </Card>
    );
  }

  const diffPct = imp.winPctDifferential != null ? imp.winPctDifferential * 100 : null;
  const diffPositive = diffPct != null && diffPct > 0;
  const diffNegative = diffPct != null && diffPct < 0;

  return (
    <div className="space-y-6">
      {/* Impact Card — headline summary */}
      <div className="rounded-md border border-border-subtle bg-surface-1 p-5">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
              diffPositive ? "bg-success-muted" : diffNegative ? "bg-danger-muted" : "bg-surface-2",
            )}
          >
            {diffPositive ? (
              <TrendingUp className="h-6 w-6 text-success" />
            ) : diffNegative ? (
              <TrendingDown className="h-6 w-6 text-danger" />
            ) : (
              <BarChart3 className="h-6 w-6 text-text-muted" />
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">Win Impact</h3>
            {diffPct != null && imp.teamRecordWithPlayer && imp.teamRecordWithout ? (
              <p className="mt-1 text-data-sm leading-relaxed text-text-secondary">
                When <strong className="text-text-primary">{profile.fullName}</strong> plays,{" "}
                {profile.team?.name ?? "the team"} wins{" "}
                <strong className={diffPositive ? "text-success" : "text-text-primary"}>
                  {((imp.teamWinPctWithPlayer ?? 0) * 100).toFixed(1)}%
                </strong>{" "}
                of games ({imp.teamRecordWithPlayer}). When he&apos;s out, they win{" "}
                <strong className={diffNegative ? "text-success" : "text-text-primary"}>
                  {((imp.teamWinPctWithout ?? 0) * 100).toFixed(1)}%
                </strong>{" "}
                ({imp.teamRecordWithout}). That&apos;s a{" "}
                <strong
                  className={cn(
                    "font-mono",
                    diffPositive ? "text-success" : diffNegative ? "text-danger" : "text-text-primary",
                  )}
                >
                  {diffPct > 0 ? "+" : ""}
                  {diffPct.toFixed(1)}%
                </strong>{" "}
                difference.
              </p>
            ) : (
              <p className="mt-1 text-data-sm text-text-muted">
                Not enough game data to calculate win differential.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Record Comparison + Win % */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Team Record Comparison" icon={Users}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-md border border-border-subtle bg-surface-2 p-3 text-center">
                <p className="text-data-xs text-text-muted">With {profile.lastName}</p>
                <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
                  {imp.teamRecordWithPlayer ?? "—"}
                </p>
                <p className="mt-0.5 text-data-xs text-text-muted">
                  {imp.teamWinPctWithPlayer != null
                    ? `${(imp.teamWinPctWithPlayer * 100).toFixed(1)}% win rate`
                    : ""}
                </p>
              </div>
              <div className="rounded-md border border-border-subtle bg-surface-2 p-3 text-center">
                <p className="text-data-xs text-text-muted">Without {profile.lastName}</p>
                <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
                  {imp.teamRecordWithout ?? "—"}
                </p>
                <p className="mt-0.5 text-data-xs text-text-muted">
                  {imp.teamWinPctWithout != null
                    ? `${(imp.teamWinPctWithout * 100).toFixed(1)}% win rate`
                    : ""}
                </p>
              </div>
            </div>
            {diffPct != null && (
              <div className="flex items-center justify-center gap-2 rounded bg-surface-2 px-3 py-2">
                <span className="text-data-sm text-text-muted">Win % Differential:</span>
                <span
                  className={cn(
                    "font-mono text-data-base font-bold",
                    diffPositive ? "text-success" : diffNegative ? "text-danger" : "text-text-primary",
                  )}
                >
                  {diffPct > 0 ? "+" : ""}
                  {diffPct.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </Card>

        <Card title="Win % Scenarios" icon={TrendingUp}>
          <div className="space-y-3">
            {!isGoalie && (
              <>
                <ImpactStatRow
                  label="When scoring a goal"
                  value={imp.teamWinPctWhenScoring}
                  tip="Team win % in games where this player scores at least one goal"
                />
                <ImpactStatRow
                  label="When getting a point"
                  value={imp.teamWinPctWhenGettingPoint}
                  tip="Team win % in games where this player records at least one point"
                />
                <ImpactStatRow
                  label="When getting 2+ points"
                  value={imp.teamWinPctWhenMultiPoint}
                  tip="Team win % in games where this player records 2 or more points"
                />
              </>
            )}
            {!isGoalie && imp.pointsPerGameInWins != null && (
              <div className="border-t border-border-subtle pt-3">
                <div className="flex items-center justify-between">
                  <Tip text="Points per game in team wins — shows if the player steps up in wins">
                    <span className="text-data-sm text-text-secondary">P/GP in Wins</span>
                  </Tip>
                  <span className="font-mono text-data-sm font-semibold text-text-primary">
                    {imp.pointsPerGameInWins.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
            {!isGoalie && imp.goalsPerGameInWins != null && (
              <div className="flex items-center justify-between">
                <Tip text="Goals per game in team wins">
                  <span className="text-data-sm text-text-secondary">G/GP in Wins</span>
                </Tip>
                <span className="font-mono text-data-sm font-semibold text-text-primary">
                  {imp.goalsPerGameInWins.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Clutch + High Impact */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Clutch Performance" icon={Sparkles}>
          <div className="space-y-4">
            {imp.clutchRating != null && (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-data-sm text-text-secondary">Clutch Rating</span>
                  <span className="font-mono text-lg font-bold text-text-primary">
                    {imp.clutchRating.toFixed(0)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      imp.clutchRating >= 60
                        ? "bg-success"
                        : imp.clutchRating >= 35
                          ? "bg-warning"
                          : "bg-danger",
                    )}
                    style={{ width: `${Math.min(100, imp.clutchRating)}%` }}
                  />
                </div>
                <p className="mt-1 text-data-xs text-text-muted">
                  Based on game-winning goals, overtime goals, and high-impact performances
                </p>
              </div>
            )}
            {!isGoalie && imp.highImpactGames != null && (
              <div className="flex items-center justify-between border-t border-border-subtle pt-3">
                <Tip text="Games with 3+ points or a game-winning goal">
                  <span className="text-data-sm text-text-secondary">High Impact Games</span>
                </Tip>
                <span className="font-mono text-data-sm font-semibold text-text-primary">
                  {imp.highImpactGames}
                </span>
              </div>
            )}
          </div>
        </Card>

        {!isGoalie && imp.gameScore != null && (
          <Card title="Game Score" icon={BarChart3}>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-data-sm text-text-secondary">Avg Game Score</span>
                  <span className="font-mono text-lg font-bold text-text-primary">
                    {imp.gameScore.toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      imp.gameScore >= 1.2
                        ? "bg-success"
                        : imp.gameScore >= 0.6
                          ? "bg-warning"
                          : "bg-danger",
                    )}
                    style={{ width: `${Math.min(100, (imp.gameScore / 2.0) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-data-xs text-text-muted">
                  Single-game impact metric — higher is better. Elite: 1.2+, Average: 0.6–1.2
                </p>
              </div>
            </div>
          </Card>
        )}

        {isGoalie && (
          <Card title="Starter Impact" icon={Shield}>
            <div className="space-y-3">
              <p className="text-data-sm text-text-secondary">
                Compares team performance when this goalie starts vs when the backup starts.
              </p>
              {imp.highImpactGames != null && imp.highImpactGames > 0 && (
                <div className="flex items-center justify-between">
                  <Tip text="Shutout games this season">
                    <span className="text-data-sm text-text-secondary">Shutouts</span>
                  </Tip>
                  <span className="font-mono text-data-sm font-semibold text-text-primary">
                    {imp.highImpactGames}
                  </span>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function ImpactStatRow({
  label,
  value,
  tip,
}: {
  label: string;
  value: number | null;
  tip: string;
}) {
  if (value == null) return null;
  const pct = value * 100;
  return (
    <div className="flex items-center justify-between">
      <Tip text={tip}>
        <span className="text-data-sm text-text-secondary">{label}</span>
      </Tip>
      <span
        className={cn(
          "font-mono text-data-sm font-semibold",
          pct >= 70 ? "text-success" : pct >= 50 ? "text-text-primary" : "text-danger",
        )}
      >
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 3: Contract Intelligence
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ContractTab({ playerId }: { playerId: string }) {
  const { data, isLoading } = trpc.player.getContractIntel.useQuery({
    playerId,
  });
  const { data: contractHistory } = trpc.player.getContractHistory.useQuery({
    playerId,
  });

  if (isLoading) return <TabSkeleton />;
  if (!data?.contract) {
    return (
      <Card title="Contract Intelligence">
        <p className="py-10 text-center text-data-sm text-text-muted">
          No contract data available
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Year-by-year cap hit */}
      <CapHitBreakdown fullCapHitByYear={data.fullCapHitByYear} valueScoreBySeason={data.valueScoreBySeason} />

      {/* Contract History */}
      {contractHistory && contractHistory.length > 0 && (
        <ContractHistoryTable contracts={contractHistory} />
      )}

      {/* Trade protection + Projection */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TradeProtectionCard contract={data.contract} />
        <ProjectionCard projection={data.projection} />
      </div>

      {/* GM Note */}
      {data.gmNote && <GMNoteCard note={data.gmNote} />}

      {/* Efficiency Ranking */}
      <EfficiencyRankingChart
        ranking={data.efficiencyRanking}
        playerId={playerId}
      />
    </div>
  );
}

type ContractHistoryEntry = RouterOutput["player"]["getContractHistory"][number];

function ContractHistoryTable({ contracts }: { contracts: ContractHistoryEntry[] }) {
  return (
    <Card title="Contract History" icon={Shield}>
      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border-subtle">
              {["Years", "Team", "AAV", "Total", "Term", "Type", "NTC", "NMC", "Status"].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left text-data-xs font-medium uppercase tracking-wider text-text-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr
                key={c.id}
                className="border-b border-border-subtle/50 hover:bg-surface-2/50"
              >
                <td className="px-3 py-2 font-mono text-data-sm text-text-primary">
                  {c.startYear}–{String(c.endYear).slice(2)}
                </td>
                <td className="px-3 py-2 text-data-sm text-text-secondary">
                  {c.teamAbbrev}
                </td>
                <td className="px-3 py-2 font-mono text-data-sm font-semibold text-text-primary">
                  {fmtCap(c.aav)}
                </td>
                <td className="px-3 py-2 font-mono text-data-sm text-text-secondary">
                  {fmtCap(c.totalValue)}
                </td>
                <td className="px-3 py-2 text-data-sm text-text-secondary">
                  {c.totalYears}yr
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-data-xs font-medium",
                      c.signingType === "ELC" && "bg-info-muted text-info",
                      c.signingType === "RFA" && "bg-warning-muted text-warning",
                      c.signingType === "UFA" && "bg-accent-muted text-accent",
                      c.signingType === "EXTENSION" && "bg-success-muted text-success",
                      !c.signingType && "bg-surface-2 text-text-muted",
                    )}
                  >
                    {c.signingType ?? "—"}
                  </span>
                </td>
                <td className="px-3 py-2 text-data-xs text-text-muted">
                  {c.hasNTC ? "✓" : "—"}
                </td>
                <td className="px-3 py-2 text-data-xs text-text-muted">
                  {c.hasNMC ? "✓" : "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-data-xs font-medium",
                      c.status === "ACTIVE" && "bg-success-muted text-success",
                      c.status === "FUTURE" && "bg-info-muted text-info",
                      c.status === "EXPIRED" && "bg-surface-2 text-text-muted",
                    )}
                  >
                    {c.status}
                  </span>
                  {c.status === "FUTURE" && (
                    <p className="mt-0.5 text-data-xs text-text-muted">
                      Begins {c.startYear}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

type ContractIntel = RouterOutput["player"]["getContractIntel"];
type ContractData = NonNullable<ContractIntel["contract"]>;

const CAP_CEILINGS: Record<string, number> = {
  "2005-06": 39_000_000,
  "2006-07": 44_000_000,
  "2007-08": 50_300_000,
  "2008-09": 56_700_000,
  "2009-10": 56_800_000,
  "2010-11": 59_400_000,
  "2011-12": 64_300_000,
  "2012-13": 70_200_000,
  "2013-14": 64_300_000,
  "2014-15": 69_000_000,
  "2015-16": 71_400_000,
  "2016-17": 73_000_000,
  "2017-18": 75_000_000,
  "2018-19": 79_500_000,
  "2019-20": 81_500_000,
  "2020-21": 81_500_000,
  "2021-22": 81_500_000,
  "2022-23": 82_500_000,
  "2023-24": 83_500_000,
  "2024-25": 88_000_000,
  "2025-26": 95_500_000,
  "2026-27": 100_000_000,
  "2027-28": 104_000_000,
  "2028-29": 108_000_000,
  "2029-30": 112_000_000,
};

function getCapCeiling(seasonKey: string): number | null {
  return CAP_CEILINGS[seasonKey] ?? null;
}

function getSeasonStartYear(seasonKey: string): number {
  return parseInt(seasonKey.substring(0, 4));
}

function CapHitBreakdown({
  fullCapHitByYear,
  valueScoreBySeason,
}: {
  fullCapHitByYear: Record<string, number>;
  valueScoreBySeason: Record<string, { score: number; grade: string | null }>;
}) {
  const years = Object.entries(fullCapHitByYear ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  if (years.length === 0) {
    return (
      <Card title="Year-by-Year Cap Hit">
        <p className="py-6 text-center text-data-sm text-text-muted">
          No year-by-year breakdown available
        </p>
      </Card>
    );
  }

  const currentSeasonKey = `${CURRENT_SEASON_START}-${String(CURRENT_SEASON_END).slice(2)}`;

  return (
    <Card title="Year-by-Year Cap Hit">
      <div className="space-y-2">
        {years.map(([year, rawAmount]) => {
          // Normalise to full dollars — values stored in millions (< 100k) get converted
          const amount = rawAmount > 0 && rawAmount < 100_000 ? rawAmount * 1_000_000 : rawAmount;
          const vs = valueScoreBySeason[year];
          const capCeiling = getCapCeiling(year);
          const barPct = capCeiling ? (amount / capCeiling) * 100 : 10;
          const capPct = capCeiling ? (amount / capCeiling) * 100 : null;
          const startYear = getSeasonStartYear(year);
          const isCurrent = year === currentSeasonKey;
          const isFuture = startYear >= CURRENT_SEASON_END;

          return (
            <div
              key={year}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-1.5",
                isCurrent && "bg-accent/5 ring-1 ring-accent/20",
                isFuture && "opacity-60",
              )}
            >
              <span
                className={cn(
                  "w-16 shrink-0 text-data-sm",
                  isCurrent ? "font-semibold text-accent" : "text-text-secondary",
                )}
              >
                {year}
              </span>
              <div className="min-w-0 flex-1">
                <div className="h-5 overflow-hidden rounded bg-surface-2">
                  <div
                    className={cn(
                      "h-full rounded transition-all duration-500",
                      isFuture ? "bg-accent/40" : "bg-accent",
                      isFuture && "border border-dashed border-accent/60",
                    )}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>
              <div className="w-24 shrink-0 text-right">
                <span className="font-mono text-data-sm font-semibold text-text-primary">
                  {fmtCap(amount)}
                </span>
                {capPct !== null && (
                  <span className="ml-1 font-mono text-data-xs text-text-muted">
                    {capPct.toFixed(1)}%
                  </span>
                )}
              </div>
              <span className="w-24 shrink-0">
                {vs ? (
                  <CapHitValueBadge score={vs.score} />
                ) : (
                  <span className="block text-center text-data-xs text-text-muted">—</span>
                )}
              </span>
              <span className="w-16 shrink-0 text-right font-mono text-data-xs text-text-muted">
                {capCeiling ? fmtCap(capCeiling) : "—"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-subtle pt-3 text-data-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" /> Past / Current
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-accent/60 bg-accent/40" /> Future (projected)
        </span>
        <span className="ml-auto">Bar = AAV as % of salary cap · Right column = cap ceiling</span>
      </div>
    </Card>
  );
}

function CapHitValueBadge({ score }: { score: number }) {
  const tier = capHitGetTier(score);
  return (
    <span
      className={cn(
        "inline-flex w-full items-center justify-center gap-1 rounded px-1.5 py-0.5 font-mono text-data-xs font-medium uppercase tracking-wider",
        tier.bg,
        tier.text,
      )}
    >
      <span className="font-semibold">{score}</span>
      <span>{tier.label}</span>
    </span>
  );
}

function capHitGetTier(score: number): { label: string; bg: string; text: string } {
  if (score >= 85) return { label: "ELITE", bg: "bg-success-muted", text: "text-success" };
  if (score >= 70) return { label: "STRONG", bg: "bg-info-muted", text: "text-info" };
  if (score >= 55) return { label: "FAIR", bg: "bg-warning-muted", text: "text-warning" };
  if (score >= 40) return { label: "BELOW", bg: "bg-purple-muted", text: "text-purple" };
  return { label: "OVERPAID", bg: "bg-danger-muted", text: "text-danger" };
}

function TradeProtectionCard({ contract }: { contract: ContractData }) {
  return (
    <Card title="Trade Protection" icon={ShieldAlert}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Tip text="No-Movement Clause — player cannot be placed on waivers or traded without consent">
            <span className="text-data-sm text-text-secondary">NMC</span>
          </Tip>
          <span
            className={cn(
              "rounded px-2 py-0.5 text-data-xs font-medium",
              contract.hasNMC
                ? "bg-danger-muted text-danger"
                : "bg-surface-2 text-text-muted",
            )}
          >
            {contract.hasNMC ? "Active" : "None"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <Tip text="No-Trade Clause — player can block trades to certain teams">
            <span className="text-data-sm text-text-secondary">NTC</span>
          </Tip>
          <span
            className={cn(
              "rounded px-2 py-0.5 text-data-xs font-medium",
              contract.hasNTC
                ? "bg-warning-muted text-warning"
                : "bg-surface-2 text-text-muted",
            )}
          >
            {contract.hasNTC ? "Active" : "None"}
          </span>
        </div>
        {contract.tradeProtectionDetails && (
          <p className="border-t border-border-subtle pt-2 text-data-xs text-text-muted">
            {contract.tradeProtectionDetails}
          </p>
        )}
        <div className="border-t border-border-subtle pt-2">
          <p className="text-data-xs text-text-muted">
            Contract expires: {contract.endYear} ·{" "}
            {contract.yearsRemaining} year{contract.yearsRemaining !== 1 ? "s" : ""}{" "}
            remaining
          </p>
        </div>
      </div>
    </Card>
  );
}

function ProjectionCard({
  projection,
}: {
  projection: ContractIntel["projection"];
}) {
  if (!projection) {
    return (
      <Card title="Next Contract Projection" icon={TrendingUp}>
        <p className="py-6 text-center text-data-sm text-text-muted">
          Not enough data for projection
        </p>
      </Card>
    );
  }

  return (
    <Card title="Next Contract Projection" icon={TrendingUp}>
      <div className="space-y-4">
        <div>
          <Tip text="Projected Average Annual Value range (low / mid / high estimate)">
            <span className="text-data-xs uppercase tracking-wider text-text-muted">
              Projected AAV
            </span>
          </Tip>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold text-text-primary">
              {fmtCap(projection.projectedAAV.mid)}
            </span>
            <span className="text-data-xs text-text-muted">
              ({fmtCap(projection.projectedAAV.low)} –{" "}
              {fmtCap(projection.projectedAAV.high)})
            </span>
          </div>
        </div>
        <div>
          <Tip text="Projected contract term range in years">
            <span className="text-data-xs uppercase tracking-wider text-text-muted">
              Projected Term
            </span>
          </Tip>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold text-text-primary">
              {projection.projectedTerm.mid} yrs
            </span>
            <span className="text-data-xs text-text-muted">
              ({projection.projectedTerm.low} – {projection.projectedTerm.high}{" "}
              yrs)
            </span>
          </div>
        </div>
        <div className="border-t border-border-subtle pt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <Tip text="Confidence level based on comparable data availability and player profile predictability">
              <span className="text-data-xs text-text-muted">Confidence</span>
            </Tip>
            <span className="font-mono text-data-sm font-semibold text-text-primary">
              {projection.confidence}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                projection.confidence >= 70
                  ? "bg-success"
                  : projection.confidence >= 45
                    ? "bg-warning"
                    : "bg-danger",
              )}
              style={{ width: `${projection.confidence}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function GMNoteCard({ note }: { note: string }) {
  return (
    <Card title="GM Intelligence Note" icon={Info}>
      <p className="text-data-sm leading-relaxed text-text-secondary">
        {note}
      </p>
    </Card>
  );
}

function EfficiencyRankingChart({
  ranking,
  playerId,
}: {
  ranking: ContractIntel["efficiencyRanking"];
  playerId: string;
}) {
  if (ranking.length === 0) return null;

  const chartData = ranking.slice(0, 20).map((r) => ({
    name:
      r.playerName.length > 14
        ? r.playerName.slice(0, 12) + "…"
        : r.playerName,
    score: r.overallScore,
    isSubject: r.playerId === playerId,
  }));

  return (
    <Card title="Cost Efficiency Ranking (Position Group)">
      <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 28)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "#64748b" }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10, fill: "#64748b" }}
            width={80}
          />
          <RechartsTooltip
            contentStyle={{
              backgroundColor: "#111827",
              border: "1px solid #334155",
              borderRadius: "0.375rem",
              fontSize: "0.75rem",
            }}
          />
          <Bar dataKey="score" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isSubject ? "#dc2626" : "#334155"}
                stroke={entry.isSubject ? "#dc2626" : undefined}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 4: Comparables
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ComparablesTab({
  playerId,
  profile,
}: {
  playerId: string;
  profile: Profile;
}) {
  const { data, isLoading } = trpc.player.getComparables.useQuery({
    playerId,
  });

  if (isLoading) return <TabSkeleton />;

  return (
    <div className="space-y-6">
      {/* Peer Comparables */}
      <PeerComparablesSection data={data} profile={profile} />

      {/* Side-by-side comparison */}
      {data?.peers && data.peers.peers.length > 0 && (
        <SideBySideComparison
          subject={profile}
          peers={data.peers.peers.slice(0, 5)}
        />
      )}

      {/* League Ranking */}
      {data?.leagueRanking && data.leagueRanking.length > 0 && (
        <LeagueRankingChart
          ranking={data.leagueRanking}
          playerId={playerId}
        />
      )}

      {/* Historical Comparables */}
      {data?.historicalComps && data.historicalComps.length > 0 && (
        <HistoricalComparablesSection comps={data.historicalComps} />
      )}
    </div>
  );
}

type ComparablesData = RouterOutput["player"]["getComparables"] | undefined;

function PeerComparablesSection({
  data,
  profile,
}: {
  data: ComparablesData;
  profile: Profile;
}) {
  const peers = data?.peers;

  if (!peers) {
    return (
      <Card title="Peer Comparables" icon={Users}>
        <p className="py-6 text-center text-data-sm text-text-muted">
          Not enough data for peer comparison
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Peer Comparables"
      subtitle={peers.summary}
      icon={Users}
    >
      <div className="mb-3 flex items-center gap-4 rounded bg-surface-2 px-3 py-2">
        <span className="text-data-xs text-text-muted">Peer Ranking</span>
        <span className="font-mono text-data-sm font-bold text-text-primary">
          #{peers.rank}
        </span>
        <span className="text-data-xs text-text-muted">
          of {peers.peers.length + 1}
        </span>
        <span className="ml-auto font-mono text-data-sm font-semibold text-accent">
          {peers.percentile}th percentile
        </span>
      </div>
      <div className="space-y-1">
        {peers.peers.map((peer, i) => (
          <PeerRow key={peer.playerId} peer={peer} rank={i + 1} />
        ))}
      </div>
    </Card>
  );
}

function PeerRow({
  peer,
  rank,
}: {
  peer: {
    playerId: string;
    playerName: string;
    position: string;
    age: number;
    aav: number;
    valueScore: number;
    points: number;
    gamesPlayed: number;
  };
  rank: number;
}) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/players/${peer.playerId}`)}
      className="group flex w-full items-center gap-3 rounded px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
    >
      <span className="w-5 text-right font-mono text-data-xs text-text-muted">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <span className="truncate text-data-sm font-medium text-text-primary group-hover:text-accent">
          {peer.playerName}
        </span>
        <span className="ml-2 text-data-xs text-text-muted">
          {peer.position} · Age {peer.age}
        </span>
      </div>
      <span className="font-mono text-data-xs text-text-muted">
        {fmtCap(peer.aav)}
      </span>
      <span className="font-mono text-data-xs text-text-muted">
        {peer.points} pts / {peer.gamesPlayed} GP
      </span>
      <span
        className="w-8 text-right font-mono text-data-sm font-semibold tabular-nums"
        style={{ color: getScoreColor(peer.valueScore) }}
      >
        {peer.valueScore}
      </span>
    </button>
  );
}

function SideBySideComparison({
  subject,
  peers,
}: {
  subject: Profile;
  peers: Array<{
    playerName: string;
    valueScore: number;
    aav: number;
    points: number;
    gamesPlayed: number;
  }>;
}) {
  const subjectScore = subject.valueScore?.overallScore ?? 0;
  const subjectPts = subject.stats?.points ?? 0;
  const subjectAAV = subject.contract?.aav ?? 0;

  const barData = [
    { name: subject.fullName, score: subjectScore, pts: subjectPts, aav: subjectAAV / 1_000_000, isSubject: true },
    ...peers.map((p) => ({
      name: p.playerName.length > 14 ? p.playerName.slice(0, 12) + "…" : p.playerName,
      score: p.valueScore,
      pts: p.points,
      aav: p.aav / 1_000_000,
      isSubject: false,
    })),
  ];

  return (
    <Card title="Side-by-Side Comparison">
      <ResponsiveContainer width="100%" height={barData.length * 40 + 40}>
        <BarChart
          data={barData}
          layout="vertical"
          margin={{ left: 80 }}
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
            tick={{ fontSize: 10, fill: "#64748b" }}
            width={80}
          />
          <RechartsTooltip
            contentStyle={{
              backgroundColor: "#111827",
              border: "1px solid #334155",
              borderRadius: "0.375rem",
              fontSize: "0.75rem",
            }}
          />
          <Bar dataKey="score" name="Value Score" radius={[0, 4, 4, 0]}>
            {barData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isSubject ? "#dc2626" : "#60a5fa"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function LeagueRankingChart({
  ranking,
  playerId,
}: {
  ranking: Array<{
    rank: number;
    playerId: string;
    playerName: string;
    overallScore: number;
    isSubject: boolean;
  }>;
  playerId: string;
}) {
  const chartData = ranking.map((r) => ({
    name:
      r.playerName.length > 14
        ? r.playerName.slice(0, 12) + "…"
        : r.playerName,
    score: r.overallScore,
    isSubject: r.playerId === playerId,
  }));

  return (
    <Card title="League-Wide Value Score Ranking">
      <ResponsiveContainer width="100%" height={Math.min(600, chartData.length * 22 + 40)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
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
            width={80}
          />
          <Bar dataKey="score" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isSubject ? "#dc2626" : "#283548"}
                stroke={entry.isSubject ? "#dc2626" : undefined}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function HistoricalComparablesSection({
  comps,
}: {
  comps: Array<{
    playerName: string;
    aav: number;
    term: number;
    ageAtSigning: number;
    productionAtSigning: number;
  }>;
}) {
  return (
    <Card
      title="Historical Comparables"
      subtitle="Players who signed similar contracts at a comparable age and production level"
    >
      <div className="space-y-1">
        {comps.map((c, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-surface-2"
          >
            <div>
              <span className="text-data-sm font-medium text-text-primary">
                {c.playerName}
              </span>
              <span className="ml-2 text-data-xs text-text-muted">
                Age {c.ageAtSigning} · {c.productionAtSigning.toFixed(0)} pts/82
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-data-sm text-text-secondary">
                {fmtCap(c.aav)}
              </span>
              <span className="text-data-xs text-text-muted">
                × {c.term} yrs
              </span>
            </div>
          </div>
        ))}
      </div>
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

function Tip({
  children,
  text,
}: {
  children: React.ReactNode;
  text: string;
}) {
  return (
    <span className="group/tip relative inline-flex cursor-help">
      {children}
      <span className="invisible absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-xs -translate-x-1/2 rounded bg-surface-3 px-2.5 py-1.5 text-data-xs leading-snug text-text-secondary shadow-lg group-hover/tip:visible">
        {text}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-surface-3" />
      </span>
    </span>
  );
}

function StatRow({
  label,
  value,
  tip,
}: {
  label: string;
  value: string | number;
  tip: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <Tip text={tip}>
        <span className="text-data-sm text-text-muted">{label}</span>
      </Tip>
      <span className="font-mono text-data-sm font-semibold text-text-primary">
        {value}
      </span>
    </div>
  );
}

function StatCell({
  label,
  value,
  tip,
}: {
  label: string;
  value: string | number;
  tip: string;
}) {
  return (
    <div className="rounded bg-surface-2 px-2 py-2 text-center">
      <Tip text={tip}>
        <span className="text-data-xs uppercase tracking-wider text-text-muted">
          {label}
        </span>
      </Tip>
      <p className="mt-0.5 font-mono text-data-base font-semibold tabular-nums text-text-primary">
        {value}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tip,
}: {
  label: string;
  value: string | number;
  tip: string;
}) {
  return (
    <div>
      <Tip text={tip}>
        <span className="text-data-xs text-text-muted">{label}</span>
      </Tip>
      <p className="font-mono text-data-sm font-semibold text-text-primary">
        {value}
      </p>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-40 animate-pulse rounded-md border border-border-subtle bg-surface-1" />
      <div className="h-10 animate-pulse rounded-md border border-border-subtle bg-surface-1" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-60 animate-pulse rounded-md border border-border-subtle bg-surface-1" />
        <div className="h-60 animate-pulse rounded-md border border-border-subtle bg-surface-1" />
      </div>
      <div className="h-24 animate-pulse rounded-md border border-border-subtle bg-surface-1" />
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-48 animate-pulse rounded-md border border-border-subtle bg-surface-1"
        />
      ))}
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

function getPctColor(
  value: number,
  bad: number,
  good: number,
): string {
  if (value >= good) return "text-success";
  if (value >= bad) return "text-warning";
  return "text-danger";
}

function fmtCap(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Goalie Analytics Components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function GoalieDangerZoneChart({
  data,
}: {
  data: Array<{
    seasonLabel: string;
    highDanger: number | null;
    mediumDanger: number | null;
    lowDanger: number | null;
    overall: number;
  }>;
}) {
  const current = data[0];
  if (!current) return null;

  const zones = [
    {
      label: "High Danger",
      value: current.highDanger,
      color: "#ef4444",
      bgColor: "bg-danger-muted",
      benchmark: 0.82,
    },
    {
      label: "Medium Danger",
      value: current.mediumDanger,
      color: "#fbbf24",
      bgColor: "bg-warning-muted",
      benchmark: 0.91,
    },
    {
      label: "Low Danger",
      value: current.lowDanger,
      color: "#10b981",
      bgColor: "bg-success-muted",
      benchmark: 0.965,
    },
  ];

  return (
    <Card title="Save % by Danger Zone" icon={Shield}>
      <div className="space-y-4">
        {zones.map((zone) => {
          const pct = zone.value ?? 0;
          const barWidth = Math.min(((pct - 0.7) / 0.3) * 100, 100);
          const aboveBenchmark = pct >= zone.benchmark;
          return (
            <div key={zone.label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-data-sm text-text-secondary">
                  {zone.label}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-data-sm font-semibold"
                    style={{ color: zone.color }}
                  >
                    {pct > 0 ? `.${(pct * 1000).toFixed(0)}` : "—"}
                  </span>
                  {zone.value != null && (
                    <span
                      className={cn(
                        "text-data-xs",
                        aboveBenchmark ? "text-success" : "text-danger",
                      )}
                    >
                      {aboveBenchmark ? "▲" : "▼"} avg .{(zone.benchmark * 1000).toFixed(0)}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(barWidth, 2)}%`,
                    backgroundColor: zone.color,
                    opacity: 0.7,
                  }}
                />
              </div>
            </div>
          );
        })}
        <div className="border-t border-border-subtle pt-3">
          <div className="flex items-center justify-between">
            <span className="text-data-xs text-text-muted">Overall Sv%</span>
            <span className="font-mono text-data-sm font-semibold text-text-primary">
              .{(current.overall * 1000).toFixed(0)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function GoalieGSAxTrend({
  data,
}: {
  data: Array<{
    seasonLabel: string;
    gsax: number;
    gamesStarted: number;
  }>;
}) {
  const sorted = [...data].reverse();

  return (
    <Card title="Goals Saved Above Expected" icon={TrendingUp}>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={sorted}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="seasonLabel"
            tick={{ fontSize: 10, fill: "#64748b" }}
          />
          <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
          <RechartsTooltip
            contentStyle={{
              backgroundColor: "#111827",
              border: "1px solid #334155",
              borderRadius: "0.375rem",
              fontSize: "0.75rem",
            }}
            formatter={(value: number) => [value.toFixed(1), "GSAx"]}
          />
          <Bar dataKey="gsax" name="GSAx" radius={[4, 4, 0, 0]}>
            {sorted.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.gsax >= 0 ? "#10b981" : "#ef4444"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-data-xs text-text-muted">
        Positive = saved more goals than expected. Higher is better.
      </p>
    </Card>
  );
}

function GoalieWorkloadAnalysis({
  data,
  isStarter,
}: {
  data: Array<{
    seasonLabel: string;
    gamesStarted: number;
    gamesPlayed: number;
    savePercentage: number;
    wins: number;
    qualityStartPct: number | null;
  }>;
  isStarter: boolean;
}) {
  return (
    <Card
      title="Workload Analysis"
      subtitle={isStarter ? "Starter" : "Backup/1B"}
    >
      <div className="space-y-3">
        {data.map((season) => (
          <div
            key={season.seasonLabel}
            className="rounded border border-border-subtle bg-surface-2 px-3 py-2"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-data-xs font-medium text-text-primary">
                {season.seasonLabel}
              </span>
              <span className="text-data-xs text-text-muted">
                {season.gamesStarted} GS / {season.gamesPlayed} GP
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-data-xs text-text-muted">Sv%</p>
                <p className="font-mono text-data-sm font-semibold text-text-primary">
                  .{(season.savePercentage * 1000).toFixed(0)}
                </p>
              </div>
              <div>
                <p className="text-data-xs text-text-muted">Wins</p>
                <p className="font-mono text-data-sm font-semibold text-text-primary">
                  {season.wins}
                </p>
              </div>
              <div>
                <p className="text-data-xs text-text-muted">QS%</p>
                <p className="font-mono text-data-sm font-semibold text-text-primary">
                  {season.qualityStartPct != null
                    ? `${season.qualityStartPct.toFixed(0)}%`
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function GoalieCreaseShare({
  data,
}: {
  data: {
    player: {
      playerName: string;
      gamesStarted: number;
      sharePercent: number;
      savePercentage: number;
      wins: number;
    };
    partners: Array<{
      playerId: string;
      playerName: string;
      gamesStarted: number;
      sharePercent: number;
      savePercentage: number;
      wins: number;
    }>;
  };
}) {
  const all = [data.player, ...data.partners];

  return (
    <Card title="Crease Share" icon={Users}>
      <div className="space-y-3">
        {all.map((g) => (
          <div key={g.playerName} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-data-sm font-medium text-text-primary">
                {g.playerName}
              </span>
              <span className="font-mono text-data-sm text-text-secondary">
                {g.sharePercent}% · {g.gamesStarted} GS
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{
                  width: `${g.sharePercent}%`,
                  opacity: g.playerName === data.player.playerName ? 1 : 0.5,
                }}
              />
            </div>
            <div className="flex gap-4 text-data-xs text-text-muted">
              <span>Sv% .{(g.savePercentage * 1000).toFixed(0)}</span>
              <span>{g.wins}W</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function GoalieBenchmarkComparison({
  playerName,
  playerStats,
  benchmarks,
}: {
  playerName: string;
  playerStats: Profile["goalieStats"];
  benchmarks: Array<{
    playerName: string;
    savePercentage: number;
    goalsAgainstAvg: number;
    gamesStarted: number;
    qualityStartPct: number | null;
    gsax: number | null;
    valueScore: number | null;
  }>;
}) {
  return (
    <Card title="Positional Benchmark (Same AAV Tier)" icon={BarChart3}>
      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="px-3 py-2 text-left text-data-xs font-medium uppercase tracking-wider text-text-muted">
                Goalie
              </th>
              <th className="px-3 py-2 text-right text-data-xs font-medium uppercase tracking-wider text-text-muted">
                Sv%
              </th>
              <th className="px-3 py-2 text-right text-data-xs font-medium uppercase tracking-wider text-text-muted">
                GAA
              </th>
              <th className="px-3 py-2 text-right text-data-xs font-medium uppercase tracking-wider text-text-muted">
                GS
              </th>
              <th className="px-3 py-2 text-right text-data-xs font-medium uppercase tracking-wider text-text-muted">
                QS%
              </th>
              <th className="px-3 py-2 text-right text-data-xs font-medium uppercase tracking-wider text-text-muted">
                GSAx
              </th>
              <th className="px-3 py-2 text-right text-data-xs font-medium uppercase tracking-wider text-text-muted">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Current player highlighted */}
            {playerStats && (
              <tr className="border-b border-accent/30 bg-accent-muted">
                <td className="px-3 py-2 text-data-sm font-semibold text-accent">
                  {playerName} ★
                </td>
                <td className="px-3 py-2 text-right font-mono text-data-sm text-text-primary">
                  .{(playerStats.savePercentage * 1000).toFixed(0)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-data-sm text-text-primary">
                  {playerStats.goalsAgainstAvg.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-data-sm text-text-primary">
                  {playerStats.gamesStarted}
                </td>
                <td className="px-3 py-2 text-right font-mono text-data-sm text-text-primary">
                  {playerStats.qualityStartPct != null
                    ? `${playerStats.qualityStartPct.toFixed(0)}%`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono text-data-sm text-text-primary">
                  {playerStats.goalsAboveExpected != null
                    ? playerStats.goalsAboveExpected.toFixed(1)
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono text-data-sm font-semibold text-accent">
                  —
                </td>
              </tr>
            )}
            {benchmarks.map((b) => (
              <tr
                key={b.playerName}
                className="border-b border-border-subtle last:border-b-0"
              >
                <td className="px-3 py-2 text-data-sm text-text-primary">
                  {b.playerName}
                </td>
                <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                  .{(b.savePercentage * 1000).toFixed(0)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                  {b.goalsAgainstAvg.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                  {b.gamesStarted}
                </td>
                <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                  {b.qualityStartPct != null
                    ? `${b.qualityStartPct.toFixed(0)}%`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                  {b.gsax != null ? b.gsax.toFixed(1) : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {b.valueScore != null ? (
                    <span
                      className="font-mono text-data-sm font-semibold"
                      style={{ color: getScoreColor(b.valueScore) }}
                    >
                      {b.valueScore}
                    </span>
                  ) : (
                    <span className="text-data-xs text-text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Negotiation Assistant Tab
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function NegotiationTab({
  playerId,
  profile,
}: {
  playerId: string;
  profile: Profile;
}) {
  const negotiation = trpc.ai.getNegotiationBrief.useMutation();

  return (
    <div className="space-y-6">
      {/* Generate button */}
      <div className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-1 px-4 py-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">
            Contract Negotiation Assistant
          </h3>
          <p className="mt-0.5 text-data-xs text-text-muted">
            AI-generated negotiation briefing with market analysis, comparable
            contracts, and strategy recommendations.
          </p>
        </div>
        <button
          onClick={() => negotiation.mutate({ playerId })}
          disabled={negotiation.isPending}
          className="flex shrink-0 items-center gap-2 rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {negotiation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {negotiation.isPending ? "Analyzing…" : "Generate Brief"}
        </button>
      </div>

      {/* Error */}
      {negotiation.isError && (
        <div className="rounded-md border border-danger/30 bg-danger-muted px-4 py-3">
          <p className="text-data-sm text-danger">
            {negotiation.error.message}
          </p>
        </div>
      )}

      {/* Results */}
      {negotiation.data && (
        <div className="space-y-6">
          {/* Player summary card */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <NegStatCard
              label="Current AAV"
              value={
                negotiation.data.currentAAV
                  ? fmtCap(negotiation.data.currentAAV)
                  : "N/A"
              }
            />
            <NegStatCard
              label="Value Score"
              value={
                negotiation.data.valueScore != null
                  ? String(negotiation.data.valueScore)
                  : "N/A"
              }
              variant={
                negotiation.data.valueScore != null
                  ? negotiation.data.valueScore >= 60
                    ? "success"
                    : negotiation.data.valueScore >= 40
                      ? "warning"
                      : "danger"
                  : undefined
              }
            />
            <NegStatCard label="Age" value={String(negotiation.data.age)} />
            <NegStatCard
              label="Comparables"
              value={String(negotiation.data.comparables.length)}
            />
          </div>

          {/* Briefing document */}
          <div className="rounded-md border border-border-subtle bg-surface-1">
            <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
              <Sparkles className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-medium text-text-primary">
                Negotiation Briefing — {negotiation.data.playerName}
              </h3>
              <span className="rounded bg-accent-muted px-1.5 py-0.5 text-data-xs font-medium text-accent">
                AI
              </span>
            </div>
            <div className="p-6">
              <NegotiationContent content={negotiation.data.briefing} />
            </div>
          </div>

          {/* Comparable contracts table */}
          {negotiation.data.comparables.length > 0 && (
            <div className="rounded-md border border-border-subtle bg-surface-1">
              <div className="border-b border-border-subtle px-4 py-3">
                <h3 className="text-sm font-medium text-text-primary">
                  Comparable Contracts
                </h3>
              </div>
              <div className="overflow-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border-subtle bg-surface-2">
                      <th className="px-3 py-2 text-left text-data-xs font-medium uppercase tracking-wider text-text-muted">
                        Player
                      </th>
                      <th className="px-3 py-2 text-right text-data-xs font-medium uppercase tracking-wider text-text-muted">
                        Age
                      </th>
                      <th className="px-3 py-2 text-right text-data-xs font-medium uppercase tracking-wider text-text-muted">
                        AAV
                      </th>
                      <th className="px-3 py-2 text-right text-data-xs font-medium uppercase tracking-wider text-text-muted">
                        Term
                      </th>
                      <th className="px-3 py-2 text-right text-data-xs font-medium uppercase tracking-wider text-text-muted">
                        Score
                      </th>
                      <th className="px-3 py-2 text-right text-data-xs font-medium uppercase tracking-wider text-text-muted">
                        Points
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {negotiation.data.comparables.map((comp) => (
                      <tr
                        key={comp.name}
                        className="border-b border-border-subtle last:border-b-0"
                      >
                        <td className="px-3 py-2 text-data-sm font-medium text-text-primary">
                          {comp.name}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                          {comp.age}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                          {comp.aav}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                          {comp.term}yr
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className="font-mono text-data-sm font-semibold"
                            style={{ color: getScoreColor(comp.score) }}
                          >
                            {comp.score}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-data-sm text-text-secondary">
                          {comp.pts}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-center gap-2 rounded-md bg-surface-2 px-4 py-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
            <p className="text-data-xs text-text-muted">
              Generated by Claude AI using current contract data and market
              comparables. All recommendations should be validated by your
              analytics and legal teams.
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!negotiation.data && !negotiation.isPending && !negotiation.isError && (
        <div className="flex flex-col items-center justify-center rounded-md border border-border-subtle bg-surface-1 py-16">
          <Sparkles className="mb-4 h-10 w-10 text-text-muted" />
          <h3 className="text-lg font-medium text-text-primary">
            Contract Negotiation Assistant
          </h3>
          <p className="mt-2 max-w-md text-center text-data-sm text-text-muted">
            Generate an AI-powered negotiation briefing for{" "}
            {profile.fullName} including fair market value analysis,
            agent and GM arguments, comparable contracts, and a recommended
            negotiation strategy.
          </p>
        </div>
      )}

      {/* Loading */}
      {negotiation.isPending && (
        <div className="flex items-center justify-center gap-2 rounded-md border border-border-subtle bg-surface-1 py-16">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <span className="text-data-sm text-text-muted">
            Analyzing contract data and market comparables…
          </span>
        </div>
      )}
    </div>
  );
}

function NegStatCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: "success" | "danger" | "warning";
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-1 px-3 py-2.5">
      <span className="text-data-xs text-text-muted">{label}</span>
      <p
        className={cn(
          "mt-0.5 font-mono text-lg font-semibold",
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

function NegotiationContent({ content }: { content: string }) {
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
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      elements.push(
        <li key={i} className="ml-4 text-data-sm text-text-secondary">
          {formatBold(trimmed.replace(/^[-•]\s*/, ""))}
        </li>,
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      elements.push(
        <li key={i} className="ml-4 list-decimal text-data-sm text-text-secondary">
          {formatBold(trimmed.replace(/^\d+\.\s*/, ""))}
        </li>,
      );
    } else {
      elements.push(
        <p key={i} className="text-data-sm leading-relaxed text-text-secondary">
          {formatBold(trimmed)}
        </p>,
      );
    }
  });

  return <>{elements}</>;
}

function formatBold(text: string): React.ReactNode {
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
