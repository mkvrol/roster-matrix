// ──────────────────────────────────────────────
// Roster Matrix — Value Engine
// Core types and public API
// ──────────────────────────────────────────────

// ── Position types ──

export type Position = "C" | "LW" | "RW" | "D" | "G";
export type PositionGroup = "F" | "D" | "G";

export function getPositionGroup(pos: Position): PositionGroup {
  if (pos === "D") return "D";
  if (pos === "G") return "G";
  return "F";
}

// ── Input types ──

export interface PlayerInput {
  position: Position;
  birthDate?: Date | string;
  age?: number;
}

export interface SkaterStatsInput {
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  toiPerGame: number;
  shots: number;
  shootingPct: number;
  hits: number;
  blocks: number;
  takeaways: number;
  giveaways: number;
  faceoffPct?: number;
  gameWinningGoals: number;
  overtimeGoals: number;
  powerPlayGoals: number;
  powerPlayAssists: number;
  powerPlayPoints: number;
  powerPlayToi?: number;
  shortHandedGoals: number;
  shortHandedAssists: number;
  shortHandedPoints: number;
  shortHandedToi?: number;
  evenStrengthGoals: number;
  evenStrengthAssists: number;
  evenStrengthPoints: number;
}

export interface AdvancedStatsInput {
  corsiForPct?: number;
  fenwickForPct?: number;
  xGFPct?: number;
  goalsForPct?: number;
  offensiveZoneStartPct?: number;
  defensiveZoneStartPct?: number;
  individualExpectedGoals?: number;
  individualHighDangerChances?: number;
  onIceShootingPct?: number;
  onIceSavePct?: number;
  pdo?: number;
  relCorsiForPct?: number;
  relXGFPct?: number;
  fiveOnFiveTOIPerGP?: number;
  ppTOIPerGP?: number;
  pkTOIPerGP?: number;
  goalsPer60?: number;
  pointsPer60?: number;
  penaltyDifferential?: number;
}

export interface WinImpactInput {
  winPctDifferential?: number;    // team win % with player minus without
  clutchRating?: number;          // derived from GWG, OT goals, close game points
  pointsPerGameInWins?: number;   // P/GP in team wins
  goalsPerGameInWins?: number;    // G/GP in team wins
  highImpactGames?: number;       // games with 3+ points or GWG
  gameScore?: number;             // average game score
  onIceGoalsForPer60?: number;
  onIceGoalsAgainstPer60?: number;
}

export interface GoalieStatsInput {
  gamesPlayed: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  otLosses: number;
  savePercentage: number;
  goalsAgainstAvg: number;
  shotsAgainst: number;
  saves: number;
  shutouts: number;
  qualityStarts?: number;
  qualityStartPct?: number;
  goalsAboveExpected?: number;
  highDangerSavePct?: number;
  mediumDangerSavePct?: number;
  lowDangerSavePct?: number;
}

export interface ContractInput {
  aav: number; // Actual dollars (e.g. 8_700_000)
  totalYears: number;
  startYear: number;
  endYear: number;
  hasNTC: boolean;
  hasNMC: boolean;
  signingType?: string;
  signingAge?: number;
}

export interface ValueInput {
  player: PlayerInput;
  stats?: SkaterStatsInput;
  advanced?: AdvancedStatsInput;
  contract: ContractInput;
  goalie?: GoalieStatsInput;
  impact?: WinImpactInput;
}

// ── Output types ──

export interface ComponentScore {
  score: number; // 0–100
  weight: number; // 0–1, sums to 1.0 across all components
  rawValue: number; // The underlying stat/metric
  benchmark: number; // League average for context
  label: string;
}

export interface ForwardComponents {
  pointsPerMillion: ComponentScore;
  fiveOnFiveImpact: ComponentScore;
  warPerDollar: ComponentScore;
  specialTeams: ComponentScore;
  shootingEfficiency: ComponentScore;
  perSixtyProduction: ComponentScore;
  durability: ComponentScore;
  ageCurve: ComponentScore;
  deploymentContext: ComponentScore;
  winImpact: ComponentScore;
}

export interface DefenseComponents {
  fiveOnFiveImpact: ComponentScore;
  pointsPerMillion: ComponentScore;
  defensiveMetrics: ComponentScore;
  perSixtyProduction: ComponentScore;
  specialTeams: ComponentScore;
  warPerDollar: ComponentScore;
  durability: ComponentScore;
  ageCurve: ComponentScore;
  deploymentContext: ComponentScore;
  winImpact: ComponentScore;
}

export interface GoalieComponents {
  gsaxPerDollar: ComponentScore;
  highDangerSavePct: ComponentScore;
  qualityStarts: ComponentScore;
  saveVsExpected: ComponentScore;
  workloadValue: ComponentScore;
  winContribution: ComponentScore;
  durability: ComponentScore;
  winImpact: ComponentScore;
}

export type ValueComponents =
  | ForwardComponents
  | DefenseComponents
  | GoalieComponents;

export type Grade = "Elite" | "Great" | "Above Average" | "Average" | "Below Average" | "Poor";

export interface ValueMeta {
  positionGroup: PositionGroup;
  aavMillions: number;
  aavTier: string;
  age: number;
  ageGroup: string;
  estimatedWAR: number;
  costPerPoint?: number;
  costPerGoal?: number;
  costPerWAR: number;
}

export interface ValueScoreResult {
  overall: number; // 1–99
  grade: Grade;
  components: ValueComponents;
  meta: ValueMeta;
}

// ── Peer comparison types ──

export interface PeerContract {
  playerId: string;
  playerName: string;
  position: Position;
  age: number;
  aav: number;
  totalYears: number;
  valueScore: number;
  points: number;
  gamesPlayed: number;
}

export interface PeerComparisonResult {
  player: PeerContract;
  peers: PeerContract[];
  rank: number; // 1-based rank among peers
  percentile: number; // 0–100
  summary: string;
}

// ── Contract projection types ──

export interface ProjectedContract {
  projectedAAV: { low: number; mid: number; high: number };
  projectedTerm: { low: number; mid: number; high: number };
  confidence: number; // 0–100
  comparables: Array<{
    playerName: string;
    aav: number;
    term: number;
    ageAtSigning: number;
    productionAtSigning: number;
  }>;
  factors: {
    currentProduction: number;
    ageAtExpiry: number;
    positionMultiplier: number;
    marketInflation: number;
  };
}

// ── Re-exports ──

export { calculateValueScore } from "./calculator";
export { BENCHMARKS, getAavTier, getAgeGroup } from "./benchmarks";
export { findComparableContracts } from "./peer-comparison";
export { projectNextContract } from "./contract-projection";
