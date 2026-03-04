// ──────────────────────────────────────────────
// Roster Matrix — Value Score Calculator
// Position-specific composite scoring engine
// ──────────────────────────────────────────────

import type {
  ValueInput,
  ValueScoreResult,
  ComponentScore,
  ForwardComponents,
  DefenseComponents,
  GoalieComponents,
  Grade,
  ValueMeta,
  SkaterStatsInput,
  ContractInput,
} from "./index";
import { getPositionGroup } from "./index";
import {
  BENCHMARKS,
  normalize,
  getAavTier,
  getAgeGroup,
  ageCurveScore,
  goalieAgeCurveScore,
  elcRookieBonus,
  productionPaceBonus,
  estimateSkaterWAR,
  estimateGoalieWAR,
} from "./benchmarks";

// ── Helpers ──

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function resolveAge(birthDate?: Date | string, age?: number): number {
  if (age != null) return age;
  if (!birthDate) return 27;
  const bd = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  const now = new Date();
  let years = now.getFullYear() - bd.getFullYear();
  if (
    now.getMonth() < bd.getMonth() ||
    (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())
  ) {
    years--;
  }
  return years;
}

function per82(stat: number, gp: number): number {
  return gp > 0 ? (stat / gp) * 82 : 0;
}

function gradeFromScore(score: number): Grade {
  if (score >= 85) return "Elite";
  if (score >= 70) return "Great";
  if (score >= 55) return "Above Average";
  if (score >= 40) return "Average";
  if (score >= 25) return "Below Average";
  return "Poor";
}

function component(
  label: string,
  score: number,
  weight: number,
  rawValue: number,
  benchmark: number,
): ComponentScore {
  return {
    label,
    score: clamp(Math.round(score), 0, 100),
    weight,
    rawValue: Math.round(rawValue * 100) / 100,
    benchmark: Math.round(benchmark * 100) / 100,
  };
}

function weightedSum(components: ComponentScore[]): number {
  let total = 0;
  for (const c of components) {
    total += c.score * c.weight;
  }
  return clamp(Math.round(total), 1, 99);
}

// ── Main entry point ──

export function calculateValueScore(input: ValueInput): ValueScoreResult {
  const posGroup = getPositionGroup(input.player.position);
  const age = resolveAge(input.player.birthDate, input.player.age);
  const aavM = input.contract.aav / 1_000_000;
  const aavSafe = Math.max(aavM, 0.75); // floor at $750K for ELC calculations

  switch (posGroup) {
    case "F":
      return calculateForwardScore(input, age, aavSafe);
    case "D":
      return calculateDefenseScore(input, age, aavSafe);
    case "G":
      return calculateGoalieScore(input, age, aavSafe);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Forward scoring
// Weights: PPM 15%, 5v5 18%, Win Impact 12%, WAR/$ 13%, ST 10%,
//          Per60 10%, Shooting 7%, Durability 5%, Age 5%, Deploy 5%
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function calculateForwardScore(
  input: ValueInput,
  age: number,
  aavM: number,
): ValueScoreResult {
  const s = input.stats!;
  const adv = input.advanced;
  const b = BENCHMARKS.F;
  const gp = Math.max(s.gamesPlayed, 1);
  const ptsPer82 = per82(s.points, gp);

  // 1. Points Per Million (15%)
  const ppm = ptsPer82 / aavM;
  const ppmScore = normalize(ppm, b.pointsPerMillion.poor, b.pointsPerMillion.average, b.pointsPerMillion.elite);

  // 2. 5v5 Impact (18%) — use CF%, xGF%, GF%, relCF%, relXGF%, G/60, P/60
  const cfScore = adv?.corsiForPct != null
    ? normalize(adv.corsiForPct, b.corsiForPct.poor, b.corsiForPct.average, b.corsiForPct.elite) : 50;
  const xgScore = adv?.xGFPct != null
    ? normalize(adv.xGFPct, b.xGFPct.poor, b.xGFPct.average, b.xGFPct.elite) : 50;
  const gfScore = adv?.goalsForPct != null
    ? normalize(adv.goalsForPct, b.goalsForPct.poor, b.goalsForPct.average, b.goalsForPct.elite) : 50;
  const relCfScore = adv?.relCorsiForPct != null
    ? normalize(adv.relCorsiForPct, b.relCorsiForPct.poor, b.relCorsiForPct.average, b.relCorsiForPct.elite) : 50;
  const relXgScore = adv?.relXGFPct != null
    ? normalize(adv.relXGFPct, b.relXGFPct.poor, b.relXGFPct.average, b.relXGFPct.elite) : 50;
  const fiveOnFiveRaw = cfScore * 0.20 + xgScore * 0.25 + gfScore * 0.15 + relCfScore * 0.15 + relXgScore * 0.25;

  // 3. WAR Per Dollar (13%)
  const war = estimateSkaterWAR(
    gp, s.points, s.plusMinus,
    adv?.corsiForPct, adv?.xGFPct,
    s.toiPerGame, false,
  );
  const warPerM = war / aavM;
  const warScore = normalize(warPerM, b.warPerMillion.poor, b.warPerMillion.average, b.warPerMillion.elite);

  // 4. Special Teams (10%) — PP production per million + PP trust (TOI)
  const ppPtsP82 = per82(s.powerPlayPoints, gp);
  const shPtsP82 = per82(s.shortHandedPoints, gp);
  const ppScore = normalize(ppPtsP82, b.ppPointsPer82.poor, b.ppPointsPer82.average, b.ppPointsPer82.elite);
  const shScore = normalize(shPtsP82, b.shPointsPer82.poor, b.shPointsPer82.average, b.shPointsPer82.elite);
  const ppToiScore = adv?.ppTOIPerGP != null
    ? normalize(adv.ppTOIPerGP, b.ppToiPerGP.poor, b.ppToiPerGP.average, b.ppToiPerGP.elite) : 50;
  const stRaw = ppScore * 0.55 + ppToiScore * 0.20 + shScore * 0.25;

  // 5. Per-60 Production (10%) — rewards efficient producers regardless of ice time
  const g60 = adv?.goalsPer60 ?? (s.evenStrengthGoals > 0 && s.toiPerGame > 0
    ? s.evenStrengthGoals / (gp * s.toiPerGame * 0.7 / 60)
    : 0);
  const p60 = adv?.pointsPer60 ?? (s.evenStrengthPoints > 0 && s.toiPerGame > 0
    ? s.evenStrengthPoints / (gp * s.toiPerGame * 0.7 / 60)
    : 0);
  const g60Score = normalize(g60, b.goalsPer60.poor, b.goalsPer60.average, b.goalsPer60.elite);
  const p60Score = normalize(p60, b.pointsPer60.poor, b.pointsPer60.average, b.pointsPer60.elite);
  const per60Raw = g60Score * 0.40 + p60Score * 0.60;

  // 6. Shooting Efficiency (7%)
  const shPctScore = normalize(s.shootingPct, b.shootingPct.poor, b.shootingPct.average, b.shootingPct.elite);
  const ixgP82 = adv?.individualExpectedGoals != null ? per82(adv.individualExpectedGoals, gp) : per82(s.goals, gp) * 0.85;
  const ixgScore = normalize(ixgP82, b.ixgPer82.poor, b.ixgPer82.average, b.ixgPer82.elite);
  const ihdcfP82 = adv?.individualHighDangerChances != null ? per82(adv.individualHighDangerChances, gp) : 0;
  const hdScore = ihdcfP82 > 0 ? normalize(ihdcfP82, 10, 30, 60) : 50;
  const shootRaw = shPctScore * 0.30 + ixgScore * 0.40 + hdScore * 0.30;

  // 7. Durability (5%)
  const gpPct = s.gamesPlayed / 82;
  const durScore = normalize(gpPct, b.gpPct.poor, b.gpPct.average, b.gpPct.elite);

  // 8. Age Curve (5%) — strengthened ELC/rookie bonus
  const baseAgeScore = ageCurveScore(age);
  const rookieBonus = elcRookieBonus(age, input.contract.aav, ptsPer82, false);
  const ageScore = clamp(Math.round(baseAgeScore * rookieBonus), 0, 100);

  // 9. Deployment Context (5%) — penalty differential + zone starts
  const penDiffScore = adv?.penaltyDifferential != null
    ? normalize(adv.penaltyDifferential, b.penaltyDifferential.poor, b.penaltyDifferential.average, b.penaltyDifferential.elite) : 50;
  const dzPct = adv?.defensiveZoneStartPct ?? 50;
  // Hard defensive deployment + still producing = bonus
  const dzBonus = dzPct > 52 ? normalize(dzPct, 52, 56, 65) * 0.5 : 0;
  const deployRaw = penDiffScore * 0.60 + (50 + dzBonus) * 0.40;

  // 10. Win Impact (12%) — team performance with/without, clutch, high-impact games
  const imp = input.impact;
  let winImpactRaw = 50; // default to average when no data
  if (imp) {
    const wpDiffScore = imp.winPctDifferential != null
      ? normalize(imp.winPctDifferential, b.winPctDifferential.poor, b.winPctDifferential.average, b.winPctDifferential.elite) : 50;
    const clutchScore = imp.clutchRating != null
      ? normalize(imp.clutchRating, b.clutchRating.poor, b.clutchRating.average, b.clutchRating.elite) : 50;
    const hiGamesPer82 = imp.highImpactGames != null ? per82(imp.highImpactGames, gp) : 0;
    const hiScore = hiGamesPer82 > 0
      ? normalize(hiGamesPer82, b.highImpactGamesRate.poor, b.highImpactGamesRate.average, b.highImpactGamesRate.elite) : 50;
    const gsScore = imp.gameScore != null
      ? normalize(imp.gameScore, b.gameScore.poor, b.gameScore.average, b.gameScore.elite) : 50;
    winImpactRaw = wpDiffScore * 0.35 + clutchScore * 0.30 + hiScore * 0.20 + gsScore * 0.15;
  }

  const components: ForwardComponents = {
    pointsPerMillion:   component("Points Per $M", ppmScore, 0.15, ppm, b.pointsPerMillion.average),
    fiveOnFiveImpact:   component("5v5 Impact", fiveOnFiveRaw, 0.18, adv?.corsiForPct ?? 50, b.corsiForPct.average),
    winImpact:          component("Win Impact", winImpactRaw, 0.12, imp?.winPctDifferential ?? 0, b.winPctDifferential.average),
    warPerDollar:       component("WAR Per $M", warScore, 0.13, warPerM, b.warPerMillion.average),
    specialTeams:       component("Special Teams", stRaw, 0.10, ppPtsP82, b.ppPointsPer82.average),
    perSixtyProduction: component("Per-60 Production", per60Raw, 0.10, p60, b.pointsPer60.average),
    shootingEfficiency: component("Shooting Efficiency", shootRaw, 0.07, s.shootingPct, b.shootingPct.average),
    durability:         component("Durability", durScore, 0.05, gpPct, b.gpPct.average),
    ageCurve:           component("Age Curve", ageScore, 0.05, age, 27),
    deploymentContext:  component("Deployment Context", deployRaw, 0.05, adv?.penaltyDifferential ?? 0, 0),
  };

  const all = Object.values(components);
  let overall = weightedSum(all);

  // Apply the best of ELC/rookie bonus or production pace bonus
  const ppg = s.points / gp;
  const paceBonus = productionPaceBonus(ppg, aavM, false);
  const bestBonus = Math.max(rookieBonus, paceBonus);
  if (bestBonus > 1.0) {
    overall = clamp(Math.round(overall * bestBonus), 1, 99);
  }

  return {
    overall,
    grade: gradeFromScore(overall),
    components,
    meta: buildMeta("F", aavM, age, war, s, input.contract),
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Defense scoring
// Weights: 5v5 22%, PPM 13%, Win Impact 10%, Defensive 13%, Per60 10%,
//          ST 8%, WAR/$ 9%, Age 5%, Durability 5%, Deploy 5%
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function calculateDefenseScore(
  input: ValueInput,
  age: number,
  aavM: number,
): ValueScoreResult {
  const s = input.stats!;
  const adv = input.advanced;
  const b = BENCHMARKS.D;
  const gp = Math.max(s.gamesPlayed, 1);
  const ptsPer82 = per82(s.points, gp);

  // 1. 5v5 Impact (22%) — with relXGF%
  const cfScore = adv?.corsiForPct != null
    ? normalize(adv.corsiForPct, b.corsiForPct.poor, b.corsiForPct.average, b.corsiForPct.elite) : 50;
  const xgScore = adv?.xGFPct != null
    ? normalize(adv.xGFPct, b.xGFPct.poor, b.xGFPct.average, b.xGFPct.elite) : 50;
  const gfScore = adv?.goalsForPct != null
    ? normalize(adv.goalsForPct, b.goalsForPct.poor, b.goalsForPct.average, b.goalsForPct.elite) : 50;
  const relCfScore = adv?.relCorsiForPct != null
    ? normalize(adv.relCorsiForPct, b.relCorsiForPct.poor, b.relCorsiForPct.average, b.relCorsiForPct.elite) : 50;
  const relXgScore = adv?.relXGFPct != null
    ? normalize(adv.relXGFPct, b.relXGFPct.poor, b.relXGFPct.average, b.relXGFPct.elite) : 50;
  const fiveOnFiveRaw = cfScore * 0.20 + xgScore * 0.20 + gfScore * 0.15 + relCfScore * 0.20 + relXgScore * 0.25;

  // 2. Points Per Million (13%)
  const ppm = ptsPer82 / aavM;
  const ppmScore = normalize(ppm, b.pointsPerMillion.poor, b.pointsPerMillion.average, b.pointsPerMillion.elite);

  // 3. Defensive Metrics (13%)
  const blkP82 = per82(s.blocks, gp);
  const hitsP82 = per82(s.hits, gp);
  const tkP82 = per82(s.takeaways, gp);
  const blkScore = normalize(blkP82, b.blocksPer82.poor, b.blocksPer82.average, b.blocksPer82.elite);
  const hitsScore = normalize(hitsP82, b.hitsPer82.poor, b.hitsPer82.average, b.hitsPer82.elite);
  const tkScore = normalize(tkP82, b.takeawaysPer82.poor, b.takeawaysPer82.average, b.takeawaysPer82.elite);
  const dzPct = adv?.defensiveZoneStartPct ?? 50;
  const dzScore = normalize(dzPct, b.dzStartPct.elite, b.dzStartPct.average, b.dzStartPct.poor); // inverted anchors
  const defRaw = blkScore * 0.30 + hitsScore * 0.15 + tkScore * 0.25 + dzScore * 0.30;

  // 4. Per-60 Production (10%)
  const g60 = adv?.goalsPer60 ?? (s.evenStrengthGoals > 0 && s.toiPerGame > 0
    ? s.evenStrengthGoals / (gp * s.toiPerGame * 0.7 / 60)
    : 0);
  const p60 = adv?.pointsPer60 ?? (s.evenStrengthPoints > 0 && s.toiPerGame > 0
    ? s.evenStrengthPoints / (gp * s.toiPerGame * 0.7 / 60)
    : 0);
  const g60Score = normalize(g60, b.goalsPer60.poor, b.goalsPer60.average, b.goalsPer60.elite);
  const p60Score = normalize(p60, b.pointsPer60.poor, b.pointsPer60.average, b.pointsPer60.elite);
  const per60Raw = g60Score * 0.35 + p60Score * 0.65;

  // 5. Special Teams (8%) — PK trust via pkTOI/GP
  const ppPtsP82 = per82(s.powerPlayPoints, gp);
  const shPtsP82 = per82(s.shortHandedPoints, gp);
  const ppScore = normalize(ppPtsP82, b.ppPointsPer82.poor, b.ppPointsPer82.average, b.ppPointsPer82.elite);
  const shScore = normalize(shPtsP82, b.shPointsPer82.poor, b.shPointsPer82.average, b.shPointsPer82.elite);
  const pkToiScore = adv?.pkTOIPerGP != null
    ? normalize(adv.pkTOIPerGP, b.pkToiPerGP.poor, b.pkToiPerGP.average, b.pkToiPerGP.elite) : 50;
  const stRaw = ppScore * 0.35 + shScore * 0.25 + pkToiScore * 0.40;

  // 6. WAR Per Dollar (9%)
  const war = estimateSkaterWAR(
    gp, s.points, s.plusMinus,
    adv?.corsiForPct, adv?.xGFPct,
    s.toiPerGame, true,
  );
  const warPerM = war / aavM;
  const warScore = normalize(warPerM, b.warPerMillion.poor, b.warPerMillion.average, b.warPerMillion.elite);

  // 7. Age Curve (5%) — with ELC/rookie bonus
  const baseAgeScore = ageCurveScore(age);
  const rookieBonus = elcRookieBonus(age, input.contract.aav, ptsPer82, true);
  const ageScore = clamp(Math.round(baseAgeScore * rookieBonus), 0, 100);

  // 8. Durability (5%)
  const gpPct = s.gamesPlayed / 82;
  const durScore = normalize(gpPct, b.gpPct.poor, b.gpPct.average, b.gpPct.elite);

  // 9. Deployment Context (5%) — penalty differential + PK trust
  const penDiffScore = adv?.penaltyDifferential != null
    ? normalize(adv.penaltyDifferential, b.penaltyDifferential.poor, b.penaltyDifferential.average, b.penaltyDifferential.elite) : 50;
  const deployRaw = penDiffScore;

  // 10. Win Impact (10%) — team performance with/without, clutch, high-impact games
  const imp = input.impact;
  let winImpactRaw = 50;
  if (imp) {
    const wpDiffScore = imp.winPctDifferential != null
      ? normalize(imp.winPctDifferential, b.winPctDifferential.poor, b.winPctDifferential.average, b.winPctDifferential.elite) : 50;
    const clutchScore = imp.clutchRating != null
      ? normalize(imp.clutchRating, b.clutchRating.poor, b.clutchRating.average, b.clutchRating.elite) : 50;
    const hiGamesPer82 = imp.highImpactGames != null ? per82(imp.highImpactGames, gp) : 0;
    const hiScore = hiGamesPer82 > 0
      ? normalize(hiGamesPer82, b.highImpactGamesRate.poor, b.highImpactGamesRate.average, b.highImpactGamesRate.elite) : 50;
    const gsScore = imp.gameScore != null
      ? normalize(imp.gameScore, b.gameScore.poor, b.gameScore.average, b.gameScore.elite) : 50;
    winImpactRaw = wpDiffScore * 0.35 + clutchScore * 0.30 + hiScore * 0.20 + gsScore * 0.15;
  }

  const components: DefenseComponents = {
    fiveOnFiveImpact:   component("5v5 Impact", fiveOnFiveRaw, 0.22, adv?.corsiForPct ?? 50, b.corsiForPct.average),
    pointsPerMillion:   component("Points Per $M", ppmScore, 0.13, ppm, b.pointsPerMillion.average),
    winImpact:          component("Win Impact", winImpactRaw, 0.10, imp?.winPctDifferential ?? 0, b.winPctDifferential.average),
    defensiveMetrics:   component("Defensive Metrics", defRaw, 0.13, blkP82, b.blocksPer82.average),
    perSixtyProduction: component("Per-60 Production", per60Raw, 0.10, p60, b.pointsPer60.average),
    specialTeams:       component("Special Teams", stRaw, 0.08, ppPtsP82, b.ppPointsPer82.average),
    warPerDollar:       component("WAR Per $M", warScore, 0.09, warPerM, b.warPerMillion.average),
    durability:         component("Durability", durScore, 0.05, gpPct, b.gpPct.average),
    ageCurve:           component("Age Curve", ageScore, 0.05, age, 27),
    deploymentContext:  component("Deployment Context", deployRaw, 0.05, adv?.penaltyDifferential ?? 0, 0),
  };

  const all = Object.values(components);
  let overall = weightedSum(all);

  // Apply the best of ELC/rookie bonus or production pace bonus
  const ppg = s.points / gp;
  const paceBonus = productionPaceBonus(ppg, aavM, true);
  const bestBonus = Math.max(rookieBonus, paceBonus);
  if (bestBonus > 1.0) {
    overall = clamp(Math.round(overall * bestBonus), 1, 99);
  }

  return {
    overall,
    grade: gradeFromScore(overall),
    components,
    meta: buildMeta("D", aavM, age, war, s, input.contract),
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Goalie scoring
// Weights: GSAx/$ 22%, HD Sv% 22%, QS% 13%, Win Impact 10%,
//          Sv% vs Expected 8%, Workload Value 10%,
//          Win Contribution 8%, Durability 7%
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function calculateGoalieScore(
  input: ValueInput,
  age: number,
  aavM: number,
): ValueScoreResult {
  const g = input.goalie!;
  const b = BENCHMARKS.G;

  // 1. GSAx Per Dollar (22%)
  // GSAx is the best single goalie metric. Normalize by AAV to find value.
  const gsax = g.goalsAboveExpected ?? (g.savePercentage - 0.910) * g.shotsAgainst;
  const gsaxPerDollar = gsax / aavM;
  const gsaxDollarScore = normalize(gsaxPerDollar, b.gsaxPerMillion.poor, b.gsaxPerMillion.average, b.gsaxPerMillion.elite);

  // 2. High-Danger Save % (22%)
  // The money stat — separates elite goalies from average ones.
  const hdPct = g.highDangerSavePct ?? Math.max(0.78, g.savePercentage - 0.06);
  const hdScore = normalize(hdPct, b.highDangerSavePct.poor, b.highDangerSavePct.average, b.highDangerSavePct.elite);

  // 3. Quality Start % (13%)
  const qsPct = g.qualityStartPct ?? (g.savePercentage > 0.910 ? 55 + (g.savePercentage - 0.910) * 500 : 40);
  const qsScore = normalize(qsPct, b.qualityStartPct.poor, b.qualityStartPct.average, b.qualityStartPct.elite);

  // 4. Save Percentage vs Expected (8%)
  // Overall performance above replacement — a .915 at $5M is fair, not overpaid.
  const svPctScore = normalize(g.savePercentage, b.savePercentage.poor, b.savePercentage.average, b.savePercentage.elite);

  // 5. Workload Value (10%)
  // Games started relative to AAV — DON'T penalize goalies who play a lot, REWARD them.
  // A goalie who starts 60 games provides more value than one who starts 30.
  const gsPerM = g.gamesStarted / aavM;
  const workloadScore = normalize(gsPerM, b.gsPerMillion.poor, b.gsPerMillion.average, b.gsPerMillion.elite);

  // 6. Win Contribution (8%)
  // Wins above replacement level (replacement = .450 win%)
  const winPct = g.gamesStarted > 0 ? g.wins / g.gamesStarted : 0;
  const winScore = normalize(winPct, b.winPct.poor, b.winPct.average, b.winPct.elite);

  // 7. Durability (7%)
  const gpPct = g.gamesPlayed / 82;
  const durScore = normalize(gpPct, b.gpPct.poor, b.gpPct.average, b.gpPct.elite);

  // 8. Win Impact (10%) — team record when this goalie starts vs backup
  const imp = input.impact;
  let winImpactRaw = 50;
  if (imp) {
    const wpDiffScore = imp.winPctDifferential != null
      ? normalize(imp.winPctDifferential, b.winPctDifferential.poor, b.winPctDifferential.average, b.winPctDifferential.elite) : 50;
    const clutchScore = imp.clutchRating != null
      ? normalize(imp.clutchRating, b.clutchRating.poor, b.clutchRating.average, b.clutchRating.elite) : 50;
    winImpactRaw = wpDiffScore * 0.70 + clutchScore * 0.30;
  }

  const components: GoalieComponents = {
    gsaxPerDollar:     component("GSAx Per $M", gsaxDollarScore, 0.22, gsaxPerDollar, b.gsaxPerMillion.average),
    highDangerSavePct: component("High-Danger Sv%", hdScore, 0.22, hdPct, b.highDangerSavePct.average),
    qualityStarts:     component("Quality Start %", qsScore, 0.13, qsPct, b.qualityStartPct.average),
    winImpact:         component("Win Impact", winImpactRaw, 0.10, imp?.winPctDifferential ?? 0, b.winPctDifferential.average),
    saveVsExpected:    component("Sv% vs Expected", svPctScore, 0.08, g.savePercentage, b.savePercentage.average),
    workloadValue:     component("Workload Value", workloadScore, 0.10, gsPerM, b.gsPerMillion.average),
    winContribution:   component("Win Contribution", winScore, 0.08, winPct, b.winPct.average),
    durability:        component("Durability", durScore, 0.07, gpPct, b.gpPct.average),
  };

  const all = Object.values(components);
  let overall = weightedSum(all);

  // Apply goalie age curve bonus (goalies peak later, 27-33)
  const goalieAgeModifier = goalieAgeCurveScore(age);
  // Blend: 95% score + 5% age curve
  overall = clamp(Math.round(overall * 0.95 + goalieAgeModifier * 0.05), 1, 99);

  // Key calibration fix: a .915 goalie at $5M should NOT be overpaid.
  // Only flag overpaid for below .910 on big contracts ($6M+) or
  // average goalies making elite money ($8M+).
  // This is handled by the recalibrated benchmarks above.

  const war = estimateGoalieWAR(g.gamesPlayed, g.gamesStarted, g.savePercentage, g.goalsAboveExpected, g.wins);

  return {
    overall,
    grade: gradeFromScore(overall),
    components,
    meta: {
      positionGroup: "G",
      aavMillions: aavM,
      aavTier: getAavTier(input.contract.aav).display,
      age,
      ageGroup: getAgeGroup(age).display,
      estimatedWAR: Math.round(war * 100) / 100,
      costPerWAR: war > 0 ? Math.round((aavM * 1_000_000) / war) : 0,
    },
  };
}

// ── Meta builder ──

function buildMeta(
  posGroup: "F" | "D",
  aavM: number,
  age: number,
  war: number,
  s: SkaterStatsInput,
  contract: ContractInput,
): ValueMeta {
  const gp = Math.max(s.gamesPlayed, 1);
  const ptsPer82 = per82(s.points, gp);
  const goalsPer82 = per82(s.goals, gp);

  return {
    positionGroup: posGroup,
    aavMillions: aavM,
    aavTier: getAavTier(contract.aav).display,
    age,
    ageGroup: getAgeGroup(age).display,
    estimatedWAR: Math.round(war * 100) / 100,
    costPerPoint: ptsPer82 > 0 ? Math.round((aavM * 1_000_000) / ptsPer82) : undefined,
    costPerGoal: goalsPer82 > 0 ? Math.round((aavM * 1_000_000) / goalsPer82) : undefined,
    costPerWAR: war > 0 ? Math.round((aavM * 1_000_000) / war) : 0,
  };
}
