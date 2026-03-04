// ──────────────────────────────────────────────
// Roster Matrix — League Benchmarks
// Normalization curves and reference tables
// ──────────────────────────────────────────────

import type { PositionGroup } from "./index";

// ── Normalization helper ──
// Maps a raw value to 0–100 using three anchor points:
//   poor → 0, average → 50, elite → 100
// Linear interpolation between anchors, clamped.

export function normalize(
  value: number,
  poor: number,
  average: number,
  elite: number,
): number {
  if (value <= poor) return 0;
  if (value >= elite) return 100;
  if (value <= average) {
    return ((value - poor) / (average - poor)) * 50;
  }
  return 50 + ((value - average) / (elite - average)) * 50;
}

// ── Benchmark anchors (poor / average / elite) ──
// Derived from league-wide distributions across 2019-2024 seasons.

export interface BenchmarkAnchors {
  poor: number;
  average: number;
  elite: number;
}

export interface PositionBenchmarks {
  // Shared
  corsiForPct: BenchmarkAnchors;
  xGFPct: BenchmarkAnchors;
  goalsForPct: BenchmarkAnchors;
  relCorsiForPct: BenchmarkAnchors;
  relXGFPct: BenchmarkAnchors;
  gpPct: BenchmarkAnchors; // GP / 82

  // Skater-specific
  pointsPerMillion: BenchmarkAnchors;
  warPerMillion: BenchmarkAnchors;
  shootingPct: BenchmarkAnchors;
  ixgPer82: BenchmarkAnchors;
  ppPointsPer82: BenchmarkAnchors;
  shPointsPer82: BenchmarkAnchors;

  // Per-60 metrics
  goalsPer60: BenchmarkAnchors;
  pointsPer60: BenchmarkAnchors;

  // Deployment
  penaltyDifferential: BenchmarkAnchors;
  ppToiPerGP: BenchmarkAnchors;
  pkToiPerGP: BenchmarkAnchors;

  // Defense-specific
  blocksPer82: BenchmarkAnchors;
  hitsPer82: BenchmarkAnchors;
  toiPerGame: BenchmarkAnchors;
  takeawaysPer82: BenchmarkAnchors;
  dzStartPct: BenchmarkAnchors;

  // Goalie-specific
  savePercentage: BenchmarkAnchors;
  gsaxPer60: BenchmarkAnchors;
  gsaxPerMillion: BenchmarkAnchors;
  qualityStartPct: BenchmarkAnchors;
  highDangerSavePct: BenchmarkAnchors;
  gsPerMillion: BenchmarkAnchors;
  winPct: BenchmarkAnchors;

  // Win Impact
  winPctDifferential: BenchmarkAnchors;
  clutchRating: BenchmarkAnchors;
  highImpactGamesRate: BenchmarkAnchors; // per 82 GP
  gameScore: BenchmarkAnchors;
}

const FORWARD_BENCHMARKS: PositionBenchmarks = {
  // 5v5 possession
  corsiForPct:    { poor: 46.0, average: 50.0, elite: 55.0 },
  xGFPct:         { poor: 46.0, average: 50.0, elite: 56.0 },
  goalsForPct:    { poor: 42.0, average: 50.0, elite: 58.0 },
  relCorsiForPct: { poor: -4.0, average: 0.0, elite: 4.0 },
  relXGFPct:      { poor: -4.0, average: 0.0, elite: 5.0 },

  // Production per dollar — recalibrated: lower elite so star-AAV players can score well
  pointsPerMillion: { poor: 3.0, average: 7.0, elite: 12.0 },
  warPerMillion:    { poor: 0.05, average: 0.30, elite: 0.80 },

  // Shooting
  shootingPct: { poor: 6.0, average: 11.0, elite: 16.0 },
  ixgPer82:    { poor: 3.0, average: 10.0, elite: 25.0 },

  // Special teams
  ppPointsPer82: { poor: 3.0, average: 12.0, elite: 30.0 },
  shPointsPer82: { poor: 0.0, average: 1.0, elite: 4.0 },

  // Per-60 at 5v5
  goalsPer60:  { poor: 0.3, average: 0.8, elite: 1.5 },
  pointsPer60: { poor: 0.8, average: 1.8, elite: 3.2 },

  // Deployment
  penaltyDifferential: { poor: -10, average: 2, elite: 15 },
  ppToiPerGP:          { poor: 0.5, average: 2.5, elite: 4.5 },
  pkToiPerGP:          { poor: 0.0, average: 0.5, elite: 2.0 },

  // Durability
  gpPct: { poor: 0.60, average: 0.85, elite: 1.0 },

  // Defense-only (unused for forwards, set to neutral values)
  blocksPer82:    { poor: 30, average: 50, elite: 80 },
  hitsPer82:      { poor: 30, average: 70, elite: 140 },
  toiPerGame:     { poor: 12.0, average: 16.5, elite: 21.0 },
  takeawaysPer82: { poor: 15, average: 30, elite: 55 },
  dzStartPct:     { poor: 55, average: 48, elite: 38 }, // inverted: lower = harder deployment

  // Goalie-only (unused for forwards)
  savePercentage:    { poor: 0.895, average: 0.910, elite: 0.925 },
  gsaxPer60:         { poor: -0.50, average: 0.0, elite: 1.0 },
  gsaxPerMillion:    { poor: -3.0, average: 0.0, elite: 5.0 },
  qualityStartPct:   { poor: 40, average: 55, elite: 70 },
  highDangerSavePct: { poor: 0.780, average: 0.820, elite: 0.870 },
  gsPerMillion:      { poor: 3.0, average: 7.0, elite: 15.0 },
  winPct:            { poor: 0.40, average: 0.50, elite: 0.62 },

  // Win Impact
  winPctDifferential: { poor: -0.05, average: 0.03, elite: 0.12 },
  clutchRating: { poor: 15, average: 40, elite: 75 },
  highImpactGamesRate: { poor: 2, average: 8, elite: 20 },
  gameScore: { poor: 0.3, average: 0.8, elite: 1.6 },
};

const DEFENSE_BENCHMARKS: PositionBenchmarks = {
  corsiForPct:    { poor: 45.0, average: 49.5, elite: 55.5 },
  xGFPct:         { poor: 45.0, average: 49.5, elite: 56.0 },
  goalsForPct:    { poor: 42.0, average: 50.0, elite: 58.0 },
  relCorsiForPct: { poor: -4.0, average: 0.0, elite: 5.0 },
  relXGFPct:      { poor: -4.0, average: 0.0, elite: 5.0 },

  pointsPerMillion: { poor: 2.0, average: 5.0, elite: 10.0 },
  warPerMillion:    { poor: 0.05, average: 0.25, elite: 0.60 },

  shootingPct: { poor: 3.0, average: 5.5, elite: 9.0 },
  ixgPer82:    { poor: 1.0, average: 5.0, elite: 15.0 },

  ppPointsPer82: { poor: 2.0, average: 8.0, elite: 25.0 },
  shPointsPer82: { poor: 0.0, average: 1.5, elite: 5.0 },

  // Per-60 at 5v5 — D-men produce less offensively
  goalsPer60:  { poor: 0.1, average: 0.35, elite: 0.8 },
  pointsPer60: { poor: 0.5, average: 1.2, elite: 2.5 },

  // Deployment
  penaltyDifferential: { poor: -8, average: 0, elite: 10 },
  ppToiPerGP:          { poor: 0.3, average: 2.0, elite: 4.0 },
  pkToiPerGP:          { poor: 0.5, average: 2.0, elite: 3.5 },

  gpPct: { poor: 0.60, average: 0.85, elite: 1.0 },

  blocksPer82:    { poor: 60, average: 100, elite: 160 },
  hitsPer82:      { poor: 25, average: 80, elite: 160 },
  toiPerGame:     { poor: 17.0, average: 21.0, elite: 25.5 },
  takeawaysPer82: { poor: 15, average: 28, elite: 50 },
  dzStartPct:     { poor: 60, average: 52, elite: 40 }, // inverted

  savePercentage:    { poor: 0.895, average: 0.910, elite: 0.925 },
  gsaxPer60:         { poor: -0.5, average: 0.0, elite: 1.0 },
  gsaxPerMillion:    { poor: -3.0, average: 0.0, elite: 5.0 },
  qualityStartPct:   { poor: 40, average: 55, elite: 70 },
  highDangerSavePct: { poor: 0.780, average: 0.820, elite: 0.870 },
  gsPerMillion:      { poor: 3, average: 7, elite: 15 },
  winPct:            { poor: 0.40, average: 0.50, elite: 0.62 },

  // Win Impact
  winPctDifferential: { poor: -0.04, average: 0.02, elite: 0.10 },
  clutchRating: { poor: 10, average: 30, elite: 60 },
  highImpactGamesRate: { poor: 1, average: 4, elite: 12 },
  gameScore: { poor: 0.2, average: 0.6, elite: 1.3 },
};

const GOALIE_BENCHMARKS: PositionBenchmarks = {
  // Goalie-specific (primary) — recalibrated: .915 at $5M is NOT overpaid
  savePercentage:    { poor: 0.900, average: 0.912, elite: 0.928 },
  gsaxPer60:         { poor: -0.50, average: 0.0, elite: 1.0 },
  gsaxPerMillion:    { poor: -2.0, average: 0.5, elite: 4.0 },
  qualityStartPct:   { poor: 38, average: 53, elite: 68 },
  highDangerSavePct: { poor: 0.790, average: 0.830, elite: 0.875 },
  gsPerMillion:      { poor: 3.0, average: 7.0, elite: 15.0 },
  winPct:            { poor: 0.40, average: 0.52, elite: 0.65 },
  gpPct:             { poor: 0.30, average: 0.55, elite: 0.75 }, // GP / 82 for goalies

  // Unused by goalies — neutral values
  corsiForPct:      { poor: 46, average: 50, elite: 55 },
  xGFPct:           { poor: 46, average: 50, elite: 55 },
  goalsForPct:      { poor: 42, average: 50, elite: 58 },
  relCorsiForPct:   { poor: -4, average: 0, elite: 4 },
  relXGFPct:        { poor: -4, average: 0, elite: 4 },
  pointsPerMillion: { poor: 0, average: 0, elite: 0 },
  warPerMillion:    { poor: 0, average: 0, elite: 0 },
  shootingPct:      { poor: 0, average: 0, elite: 0 },
  ixgPer82:         { poor: 0, average: 0, elite: 0 },
  ppPointsPer82:    { poor: 0, average: 0, elite: 0 },
  shPointsPer82:    { poor: 0, average: 0, elite: 0 },
  goalsPer60:       { poor: 0, average: 0, elite: 0 },
  pointsPer60:      { poor: 0, average: 0, elite: 0 },
  penaltyDifferential: { poor: 0, average: 0, elite: 0 },
  ppToiPerGP:       { poor: 0, average: 0, elite: 0 },
  pkToiPerGP:       { poor: 0, average: 0, elite: 0 },
  blocksPer82:      { poor: 0, average: 0, elite: 0 },
  hitsPer82:        { poor: 0, average: 0, elite: 0 },
  toiPerGame:       { poor: 0, average: 0, elite: 0 },
  takeawaysPer82:   { poor: 0, average: 0, elite: 0 },
  dzStartPct:       { poor: 0, average: 0, elite: 0 },

  // Win Impact
  winPctDifferential: { poor: -0.05, average: 0.03, elite: 0.12 },
  clutchRating: { poor: 10, average: 30, elite: 60 },
  highImpactGamesRate: { poor: 0, average: 0, elite: 0 },
  gameScore: { poor: 0, average: 0, elite: 0 },
};

export const BENCHMARKS: Record<PositionGroup, PositionBenchmarks> = {
  F: FORWARD_BENCHMARKS,
  D: DEFENSE_BENCHMARKS,
  G: GOALIE_BENCHMARKS,
};

// ── AAV tier classification ──

export type AavTier = "entry" | "depth" | "middle" | "top6" | "star" | "elite";

const AAV_TIERS: Array<{ label: AavTier; display: string; min: number; max: number }> = [
  { label: "entry", display: "Entry-Level ($0–$1M)", min: 0, max: 1_000_000 },
  { label: "depth", display: "Depth ($1M–$3M)", min: 1_000_000, max: 3_000_000 },
  { label: "middle", display: "Middle ($3M–$5M)", min: 3_000_000, max: 5_000_000 },
  { label: "top6", display: "Top-6 ($5M–$8M)", min: 5_000_000, max: 8_000_000 },
  { label: "star", display: "Star ($8M–$10M)", min: 8_000_000, max: 10_000_000 },
  { label: "elite", display: "Elite ($10M+)", min: 10_000_000, max: Infinity },
];

export function getAavTier(aav: number): { label: AavTier; display: string } {
  const tier = AAV_TIERS.find((t) => aav >= t.min && aav < t.max);
  return tier
    ? { label: tier.label, display: tier.display }
    : { label: "elite", display: "Elite ($10M+)" };
}

// ── Age group classification ──

export type AgeGroup = "entry" | "emerging" | "prime" | "peak" | "declining" | "veteran";

const AGE_GROUPS: Array<{ label: AgeGroup; display: string; min: number; max: number }> = [
  { label: "entry", display: "Entry (≤21)", min: 0, max: 22 },
  { label: "emerging", display: "Emerging (22–23)", min: 22, max: 24 },
  { label: "prime", display: "Prime (24–27)", min: 24, max: 28 },
  { label: "peak", display: "Peak (28–29)", min: 28, max: 30 },
  { label: "declining", display: "Declining (30–33)", min: 30, max: 34 },
  { label: "veteran", display: "Veteran (34+)", min: 34, max: 99 },
];

export function getAgeGroup(age: number): { label: AgeGroup; display: string } {
  const group = AGE_GROUPS.find((g) => age >= g.min && age < g.max);
  return group
    ? { label: group.label, display: group.display }
    : { label: "veteran", display: "Veteran (34+)" };
}

// ── Age curve modifier (returns 0–100 score) ──
// Skater curve: peaks 24-27, declines after 29

export function ageCurveScore(age: number): number {
  if (age <= 20) return 70;
  if (age <= 21) return 73;
  if (age <= 23) return 78;
  if (age <= 27) return 85; // prime
  if (age <= 29) return 82; // late prime
  if (age === 30) return 68;
  if (age === 31) return 58;
  if (age === 32) return 48;
  if (age === 33) return 38;
  if (age === 34) return 28;
  return Math.max(10, 28 - (age - 34) * 8); // 35+ steep decline
}

// ── ELC / Rookie bonus ──
// Returns a multiplier (1.0 = no bonus) applied to the overall score.
// ELC players producing at top-6 rates get a massive value boost.

export function elcRookieBonus(
  age: number,
  aav: number,
  pointsPer82: number,
  isDefenseman: boolean,
): number {
  const aavM = aav / 1_000_000;
  const isELC = aavM < 1.0;
  const isBridge = aavM >= 1.0 && aavM < 3.0 && age <= 24;

  if (!isELC && !isBridge) return 1.0;

  // Threshold for "top-6 rate" production
  const topSixThreshold = isDefenseman ? 35 : 50;
  const eliteThreshold = isDefenseman ? 50 : 65;

  if (isELC) {
    if (pointsPer82 >= eliteThreshold) return 1.35; // 60+ pts on ELC → massive boost
    if (pointsPer82 >= topSixThreshold) return 1.22; // 50+ pts on ELC → strong boost
    if (pointsPer82 >= topSixThreshold * 0.7) return 1.12; // 35+ pts on ELC → moderate boost
    return 1.05; // Any ELC player gets a small bonus
  }

  // Bridge deal bonus (smaller)
  if (isBridge) {
    if (pointsPer82 >= eliteThreshold) return 1.15;
    if (pointsPer82 >= topSixThreshold) return 1.08;
    return 1.0;
  }

  return 1.0;
}

// ── Goalie age curve (peaks later: 27-33) ──

export function goalieAgeCurveScore(age: number): number {
  if (age <= 22) return 55;
  if (age <= 24) return 65;
  if (age <= 26) return 75;
  if (age <= 29) return 85; // early prime
  if (age <= 33) return 82; // goalies sustain performance
  if (age === 34) return 72;
  if (age === 35) return 62;
  if (age === 36) return 50;
  if (age === 37) return 40;
  return Math.max(15, 40 - (age - 37) * 10); // 38+ decline
}

// ── Production pace bonus ──
// Multiplier applied to overall score when P/GP exceeds thresholds for the AAV.
// A point-per-game forward on under $10M should NEVER be below "Strong Value".

export function productionPaceBonus(
  ppg: number,
  aavM: number,
  isDefenseman: boolean,
): number {
  if (isDefenseman) {
    // Defensemen produce fewer points; thresholds are lower
    if (ppg >= 0.65 && aavM <= 10) return 1.18;
    if (ppg >= 0.55 && aavM <= 8) return 1.15;
    if (ppg >= 0.45 && aavM <= 6) return 1.12;
    if (ppg >= 0.55 && aavM <= 10) return 1.10;
    if (ppg >= 0.45 && aavM <= 8) return 1.08;
    return 1.0;
  }

  // Forwards: P/GP is the most important value indicator
  if (ppg >= 1.0 && aavM <= 10) return 1.25;   // PPG on under $10M = Strong Value
  if (ppg >= 0.85 && aavM <= 8) return 1.22;    // 0.85+ P/GP on under $8M = Strong Value
  if (ppg >= 0.70 && aavM <= 6) return 1.18;    // 0.70+ P/GP on under $6M = Strong Value
  // Smaller bonuses for slightly outside the core thresholds
  if (ppg >= 1.0 && aavM <= 13) return 1.18;    // PPG on under $13M
  if (ppg >= 0.85 && aavM <= 10) return 1.15;   // 0.85+ P/GP on under $10M
  if (ppg >= 0.70 && aavM <= 8) return 1.10;    // 0.70+ P/GP on under $8M
  if (ppg >= 0.60 && aavM <= 5) return 1.08;    // 0.60+ P/GP on under $5M
  return 1.0;
}

// ── WAR estimation from available stats ──
// Approximation using publicly available data. Not a replacement for
// proprietary WAR models, but directionally accurate.

export function estimateSkaterWAR(
  gp: number,
  points: number,
  plusMinus: number,
  cfPct: number | undefined,
  xgfPct: number | undefined,
  toi: number,
  isDefenseman: boolean,
): number {
  const games = Math.max(gp, 1);

  // Offensive component: point production per 82 games
  const ptsPer82 = (points / games) * 82;
  const offWar = ptsPer82 * 0.025;

  // Possession component: driving play
  const cfBonus = cfPct != null ? (cfPct - 50) * 0.06 : 0;
  const xgBonus = xgfPct != null ? (xgfPct - 50) * 0.04 : 0;

  // Plus/minus per game as a rough on-ice impact
  const pmPer82 = (plusMinus / games) * 82;
  const pmWar = pmPer82 * 0.015;

  // TOI utilization: coaches trust = more ice time
  const toiBonus = Math.max(0, (toi - 15) * 0.03);

  // Positional adjustment: defensemen provide structural value
  const posBonus = isDefenseman ? 0.5 : 0;

  return Math.max(0, offWar + cfBonus + xgBonus + pmWar + toiBonus + posBonus);
}

export function estimateGoalieWAR(
  gp: number,
  gs: number,
  svPct: number,
  gsax: number | undefined,
  wins: number,
): number {
  // Save-based component
  const svAboveAvg = (svPct - 0.910) * 100;
  const svWar = svAboveAvg * 0.8;

  // GSAX component (if available)
  const gsaxWar = gsax != null ? gsax * 0.08 : 0;

  // Win contribution
  const winRate = gs > 0 ? wins / gs : 0;
  const winWar = (winRate - 0.45) * 3;

  // Workload bonus
  const loadBonus = Math.max(0, (gs - 40) * 0.02);

  return Math.max(0, svWar + gsaxWar + winWar + loadBonus);
}
