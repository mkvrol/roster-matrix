import { describe, it, expect } from "vitest";
import { calculateValueScore } from "../calculator";
import type {
  ValueInput,
  SkaterStatsInput,
  AdvancedStatsInput,
  GoalieStatsInput,
  ContractInput,
  WinImpactInput,
  ForwardComponents,
  DefenseComponents,
  GoalieComponents,
} from "../index";

// ── Helper factories ──

function makeContract(overrides: Partial<ContractInput> = {}): ContractInput {
  return {
    aav: 5_000_000,
    totalYears: 4,
    startYear: 2024,
    endYear: 2028,
    hasNTC: false,
    hasNMC: false,
    ...overrides,
  };
}

function makeSkaterStats(overrides: Partial<SkaterStatsInput> = {}): SkaterStatsInput {
  return {
    gamesPlayed: 82,
    goals: 20,
    assists: 30,
    points: 50,
    plusMinus: 5,
    pim: 20,
    toiPerGame: 17.0,
    shots: 180,
    shootingPct: 11.1,
    hits: 40,
    blocks: 20,
    takeaways: 25,
    giveaways: 18,
    gameWinningGoals: 4,
    overtimeGoals: 1,
    powerPlayGoals: 6,
    powerPlayAssists: 10,
    powerPlayPoints: 16,
    powerPlayToi: 3.5,
    shortHandedGoals: 0,
    shortHandedAssists: 1,
    shortHandedPoints: 1,
    shortHandedToi: 1.5,
    evenStrengthGoals: 14,
    evenStrengthAssists: 19,
    evenStrengthPoints: 33,
    ...overrides,
  };
}

function makeAdvanced(overrides: Partial<AdvancedStatsInput> = {}): AdvancedStatsInput {
  return {
    corsiForPct: 51.0,
    xGFPct: 52.0,
    goalsForPct: 53.0,
    relCorsiForPct: 1.5,
    relXGFPct: 2.0,
    individualExpectedGoals: 12.0,
    individualHighDangerChances: 40,
    goalsPer60: 0.9,
    pointsPer60: 2.0,
    penaltyDifferential: 3,
    ppTOIPerGP: 3.0,
    pkTOIPerGP: 1.0,
    ...overrides,
  };
}

function makeGoalieStats(overrides: Partial<GoalieStatsInput> = {}): GoalieStatsInput {
  return {
    gamesPlayed: 55,
    gamesStarted: 52,
    wins: 30,
    losses: 15,
    otLosses: 5,
    savePercentage: 0.915,
    goalsAgainstAvg: 2.50,
    shotsAgainst: 1500,
    saves: 1373,
    shutouts: 3,
    qualityStarts: 30,
    qualityStartPct: 57.7,
    goalsAboveExpected: 7.5,
    highDangerSavePct: 0.830,
    ...overrides,
  };
}

// ── Tests ──

describe("calculateValueScore", () => {
  // ──────────────────────────────────────────────
  // 1. Elite Forward — McDavid archetype
  // ──────────────────────────────────────────────
  it("scores an elite forward (McDavid-type) highly", () => {
    const input: ValueInput = {
      player: { position: "C", age: 28 },
      stats: makeSkaterStats({
        gamesPlayed: 82, goals: 50, assists: 84, points: 134,
        plusMinus: 30, toiPerGame: 22.5, shots: 320, shootingPct: 15.6,
        hits: 28, blocks: 15, takeaways: 72, giveaways: 48,
        powerPlayGoals: 15, powerPlayAssists: 28, powerPlayPoints: 43,
        shortHandedGoals: 1, shortHandedAssists: 2, shortHandedPoints: 3,
        evenStrengthGoals: 34, evenStrengthAssists: 54, evenStrengthPoints: 88,
        gameWinningGoals: 10, overtimeGoals: 3,
      }),
      advanced: makeAdvanced({
        corsiForPct: 55.0, xGFPct: 57.0, goalsForPct: 60.0,
        relCorsiForPct: 5.0, relXGFPct: 6.0,
        individualExpectedGoals: 30.0, individualHighDangerChances: 80,
        goalsPer60: 1.5, pointsPer60: 3.5, penaltyDifferential: 12,
      }),
      contract: makeContract({ aav: 16_000_000 }),
    };

    const result = calculateValueScore(input);
    expect(result.overall).toBeGreaterThanOrEqual(65);
    expect(result.grade).toMatch(/Elite|Great/);
    expect(result.meta.positionGroup).toBe("F");

    const c = result.components as ForwardComponents;
    expect(c.fiveOnFiveImpact.score).toBeGreaterThan(70);
    expect(c.shootingEfficiency.score).toBeGreaterThan(60);
  });

  // ──────────────────────────────────────────────
  // 2. Underpaid Young Star — ELC superstar (Demidov-type)
  // A rookie putting up 60+ pts on an ELC should score 90+
  // ──────────────────────────────────────────────
  it("gives highest value to an ELC player producing like a star", () => {
    const input: ValueInput = {
      player: { position: "C", age: 20 },
      stats: makeSkaterStats({
        gamesPlayed: 82, goals: 25, assists: 40, points: 65,
        plusMinus: -5, toiPerGame: 19.0, shots: 210, shootingPct: 11.9,
        hits: 15, blocks: 8, takeaways: 38, giveaways: 30,
        powerPlayGoals: 8, powerPlayAssists: 14, powerPlayPoints: 22,
        shortHandedGoals: 0, shortHandedAssists: 0, shortHandedPoints: 0,
        evenStrengthGoals: 17, evenStrengthAssists: 26, evenStrengthPoints: 43,
        gameWinningGoals: 5, overtimeGoals: 1,
      }),
      advanced: makeAdvanced({
        corsiForPct: 49.0, xGFPct: 48.0, relCorsiForPct: -1.0, relXGFPct: -1.5,
        goalsPer60: 0.85, pointsPer60: 2.1,
      }),
      contract: makeContract({ aav: 950_000, signingType: "ELC" }),
    };

    const result = calculateValueScore(input);

    // ELC producing 65 points = elite value per dollar → should be 85+
    expect(result.overall).toBeGreaterThanOrEqual(85);
    const c = result.components as ForwardComponents;
    expect(c.pointsPerMillion.score).toBeGreaterThan(90);
    expect(c.warPerDollar.score).toBeGreaterThan(70);
  });

  // ──────────────────────────────────────────────
  // 3. Middle-6 Forward — Average value
  // ──────────────────────────────────────────────
  it("scores a middle-6 forward at an appropriate AAV as average", () => {
    const input: ValueInput = {
      player: { position: "LW", age: 27 },
      stats: makeSkaterStats({
        gamesPlayed: 78, goals: 18, assists: 22, points: 40,
        plusMinus: 3, toiPerGame: 16.0, shots: 155, shootingPct: 11.6,
        powerPlayGoals: 4, powerPlayAssists: 6, powerPlayPoints: 10,
        shortHandedGoals: 0, shortHandedAssists: 0, shortHandedPoints: 0,
        evenStrengthGoals: 14, evenStrengthAssists: 16, evenStrengthPoints: 30,
        gameWinningGoals: 3, overtimeGoals: 0,
      }),
      advanced: makeAdvanced({ corsiForPct: 50.5, xGFPct: 50.0, relCorsiForPct: 0.5 }),
      contract: makeContract({ aav: 4_500_000 }),
    };

    const result = calculateValueScore(input);
    expect(result.overall).toBeGreaterThanOrEqual(35);
    expect(result.overall).toBeLessThanOrEqual(65);
    expect(result.grade).toMatch(/Average|Above Average/);
  });

  // ──────────────────────────────────────────────
  // 4. Overpaid Veteran Forward
  // ──────────────────────────────────────────────
  it("penalizes an overpaid declining veteran", () => {
    const input: ValueInput = {
      player: { position: "C", age: 34 },
      stats: makeSkaterStats({
        gamesPlayed: 65, goals: 12, assists: 18, points: 30,
        plusMinus: -8, toiPerGame: 15.5, shots: 120, shootingPct: 10.0,
        powerPlayGoals: 3, powerPlayAssists: 5, powerPlayPoints: 8,
        shortHandedGoals: 0, shortHandedAssists: 0, shortHandedPoints: 0,
        evenStrengthGoals: 9, evenStrengthAssists: 13, evenStrengthPoints: 22,
        gameWinningGoals: 2, overtimeGoals: 0,
      }),
      advanced: makeAdvanced({
        corsiForPct: 47.0, xGFPct: 46.0, goalsForPct: 44.0,
        relCorsiForPct: -3.0, relXGFPct: -3.5,
        goalsPer60: 0.45, pointsPer60: 1.1, penaltyDifferential: -5,
      }),
      contract: makeContract({ aav: 8_500_000, hasNMC: true }),
    };

    const result = calculateValueScore(input);
    expect(result.overall).toBeLessThan(40);
    expect(result.grade).toMatch(/Below Average|Poor/);

    const c = result.components as ForwardComponents;
    expect(c.pointsPerMillion.score).toBeLessThan(30);
    expect(c.ageCurve.score).toBeLessThan(35);
    expect(c.durability.score).toBeLessThan(55);
  });

  // ──────────────────────────────────────────────
  // 5. Top-Pair Defenseman — High-end 2-way D
  // ──────────────────────────────────────────────
  it("scores a top-pair two-way defenseman well", () => {
    const input: ValueInput = {
      player: { position: "D", age: 25 },
      stats: makeSkaterStats({
        gamesPlayed: 82, goals: 15, assists: 50, points: 65,
        plusMinus: 22, toiPerGame: 25.0, shots: 185, shootingPct: 8.1,
        hits: 42, blocks: 78, takeaways: 38, giveaways: 24,
        powerPlayGoals: 6, powerPlayAssists: 18, powerPlayPoints: 24,
        shortHandedGoals: 0, shortHandedAssists: 1, shortHandedPoints: 1,
        evenStrengthGoals: 9, evenStrengthAssists: 31, evenStrengthPoints: 40,
        gameWinningGoals: 3, overtimeGoals: 1,
      }),
      advanced: makeAdvanced({
        corsiForPct: 54.0, xGFPct: 55.0, goalsForPct: 57.0,
        relCorsiForPct: 4.0, relXGFPct: 4.5, defensiveZoneStartPct: 52.0,
        goalsPer60: 0.5, pointsPer60: 1.8, penaltyDifferential: 5,
        pkTOIPerGP: 2.5,
      }),
      contract: makeContract({ aav: 8_200_000 }),
    };

    const result = calculateValueScore(input);
    expect(result.overall).toBeGreaterThanOrEqual(55);
    expect(result.meta.positionGroup).toBe("D");

    const c = result.components as DefenseComponents;
    expect(c.fiveOnFiveImpact.weight).toBe(0.22);
    expect(c.defensiveMetrics.score).toBeGreaterThan(40);
  });

  // ──────────────────────────────────────────────
  // 6. Bottom-Pair Defenseman — Physical, cheap deal
  // Should be decent value if they play well on a cheap deal
  // ──────────────────────────────────────────────
  it("evaluates a bottom-pair physical D on a cheap deal", () => {
    const input: ValueInput = {
      player: { position: "D", age: 31 },
      stats: makeSkaterStats({
        gamesPlayed: 72, goals: 3, assists: 10, points: 13,
        plusMinus: -2, toiPerGame: 19.0, shots: 68, shootingPct: 4.4,
        hits: 145, blocks: 110, takeaways: 12, giveaways: 16,
        powerPlayGoals: 0, powerPlayAssists: 2, powerPlayPoints: 2,
        shortHandedGoals: 0, shortHandedAssists: 0, shortHandedPoints: 0,
        evenStrengthGoals: 3, evenStrengthAssists: 8, evenStrengthPoints: 11,
        gameWinningGoals: 1, overtimeGoals: 0,
      }),
      advanced: makeAdvanced({
        corsiForPct: 47.5, xGFPct: 47.0, goalsForPct: 46.0,
        relCorsiForPct: -2.5, relXGFPct: -2.0, defensiveZoneStartPct: 58.0,
        goalsPer60: 0.15, pointsPer60: 0.55, penaltyDifferential: -2,
        pkTOIPerGP: 2.0,
      }),
      contract: makeContract({ aav: 2_500_000 }),
    };

    const result = calculateValueScore(input);
    // Cheap deal mitigates poor possession stats
    expect(result.overall).toBeGreaterThanOrEqual(30);
    expect(result.overall).toBeLessThanOrEqual(60);

    const c = result.components as DefenseComponents;
    expect(c.defensiveMetrics.score).toBeGreaterThan(50);
  });

  // ──────────────────────────────────────────────
  // 7. Overpaid Defenseman — Bad contract
  // ──────────────────────────────────────────────
  it("flags an overpaid defenseman on a bad contract", () => {
    const input: ValueInput = {
      player: { position: "D", age: 30 },
      stats: makeSkaterStats({
        gamesPlayed: 78, goals: 8, assists: 25, points: 33,
        plusMinus: -3, toiPerGame: 24.0, shots: 135, shootingPct: 5.9,
        hits: 78, blocks: 100, takeaways: 25, giveaways: 28,
        powerPlayGoals: 3, powerPlayAssists: 10, powerPlayPoints: 13,
        shortHandedGoals: 0, shortHandedAssists: 0, shortHandedPoints: 0,
        evenStrengthGoals: 5, evenStrengthAssists: 15, evenStrengthPoints: 20,
        gameWinningGoals: 2, overtimeGoals: 0,
      }),
      advanced: makeAdvanced({
        corsiForPct: 48.0, xGFPct: 47.5, goalsForPct: 46.0,
        relCorsiForPct: -2.0, relXGFPct: -2.5,
        goalsPer60: 0.25, pointsPer60: 0.95, penaltyDifferential: -3,
      }),
      contract: makeContract({ aav: 9_500_000, hasNMC: true }),
    };

    const result = calculateValueScore(input);
    expect(result.overall).toBeLessThan(45);

    const c = result.components as DefenseComponents;
    expect(c.pointsPerMillion.score).toBeLessThan(30);
  });

  // ──────────────────────────────────────────────
  // 8. Elite Starter Goalie — Hellebuyck type
  // ──────────────────────────────────────────────
  it("scores an elite starter goalie appropriately", () => {
    const input: ValueInput = {
      player: { position: "G", age: 31 },
      goalie: makeGoalieStats({
        gamesPlayed: 62, gamesStarted: 60,
        wins: 37, losses: 16, otLosses: 6,
        savePercentage: 0.925, goalsAgainstAvg: 2.25,
        shotsAgainst: 1810, saves: 1674, shutouts: 5,
        qualityStartPct: 65.0, goalsAboveExpected: 18.0,
        highDangerSavePct: 0.860,
      }),
      contract: makeContract({ aav: 8_500_000 }),
    };

    const result = calculateValueScore(input);
    expect(result.overall).toBeGreaterThanOrEqual(60);
    expect(result.meta.positionGroup).toBe("G");

    const c = result.components as GoalieComponents;
    expect(c.gsaxPerDollar.score).toBeGreaterThan(70);
    expect(c.highDangerSavePct.score).toBeGreaterThan(70);
    expect(c.winContribution.score).toBeGreaterThan(60);
  });

  // ──────────────────────────────────────────────
  // 9. Gibson-type: Good goalie, reasonable contract
  // A .915 goalie at $5M should be fair value or better, NOT overpaid
  // ──────────────────────────────────────────────
  it("scores a .915 goalie at $5M as fair value or better", () => {
    const input: ValueInput = {
      player: { position: "G", age: 31 },
      goalie: makeGoalieStats({
        gamesPlayed: 55, gamesStarted: 52,
        wins: 28, losses: 17, otLosses: 5,
        savePercentage: 0.915, goalsAgainstAvg: 2.55,
        shotsAgainst: 1500, saves: 1373, shutouts: 3,
        qualityStartPct: 55.0, goalsAboveExpected: 5.0,
        highDangerSavePct: 0.825,
      }),
      contract: makeContract({ aav: 5_000_000 }),
    };

    const result = calculateValueScore(input);
    // Fair value or better — NOT overpaid
    expect(result.overall).toBeGreaterThanOrEqual(45);
    expect(result.grade).not.toBe("Poor");
    expect(result.grade).not.toBe("Below Average");
  });

  // ──────────────────────────────────────────────
  // 10. Backup Goalie — Cheap, average stats
  // ──────────────────────────────────────────────
  it("gives a backup goalie on a cheap deal decent value", () => {
    const input: ValueInput = {
      player: { position: "G", age: 29 },
      goalie: makeGoalieStats({
        gamesPlayed: 28, gamesStarted: 25,
        wins: 12, losses: 8, otLosses: 3,
        savePercentage: 0.908, goalsAgainstAvg: 2.80,
        shotsAgainst: 700, saves: 636, shutouts: 1,
        qualityStartPct: 52.0, goalsAboveExpected: -1.4,
        highDangerSavePct: 0.810,
      }),
      contract: makeContract({ aav: 1_500_000 }),
    };

    const result = calculateValueScore(input);
    expect(result.overall).toBeGreaterThanOrEqual(35);
    expect(result.overall).toBeLessThanOrEqual(65);

    const c = result.components as GoalieComponents;
    expect(c.workloadValue.score).toBeGreaterThan(50);
  });

  // ──────────────────────────────────────────────
  // 11. Overpaid Goalie — Bad contract
  // Below .910 on $6M+ = overpaid
  // ──────────────────────────────────────────────
  it("penalizes an overpaid goalie with poor stats", () => {
    const input: ValueInput = {
      player: { position: "G", age: 30 },
      goalie: makeGoalieStats({
        gamesPlayed: 40, gamesStarted: 38,
        wins: 14, losses: 18, otLosses: 4,
        savePercentage: 0.898, goalsAgainstAvg: 3.20,
        shotsAgainst: 1050, saves: 943, shutouts: 0,
        qualityStartPct: 40.0, goalsAboveExpected: -12.6,
        highDangerSavePct: 0.790,
      }),
      contract: makeContract({ aav: 6_000_000 }),
    };

    const result = calculateValueScore(input);
    expect(result.overall).toBeLessThan(35);

    const c = result.components as GoalieComponents;
    expect(c.gsaxPerDollar.score).toBeLessThan(30);
    expect(c.highDangerSavePct.score).toBeLessThan(25);
  });

  // ──────────────────────────────────────────────
  // 12. Young D on ELC — rookie D producing well
  // ──────────────────────────────────────────────
  it("gives strong value to a young D on an ELC producing well", () => {
    const input: ValueInput = {
      player: { position: "D", age: 21 },
      stats: makeSkaterStats({
        gamesPlayed: 78, goals: 10, assists: 35, points: 45,
        plusMinus: 8, toiPerGame: 22.0, shots: 140, shootingPct: 7.1,
        hits: 35, blocks: 85, takeaways: 30, giveaways: 20,
        powerPlayGoals: 4, powerPlayAssists: 12, powerPlayPoints: 16,
        shortHandedGoals: 0, shortHandedAssists: 1, shortHandedPoints: 1,
        evenStrengthGoals: 6, evenStrengthAssists: 22, evenStrengthPoints: 28,
        gameWinningGoals: 2, overtimeGoals: 0,
      }),
      advanced: makeAdvanced({
        corsiForPct: 52.0, xGFPct: 53.0, goalsForPct: 54.0,
        relCorsiForPct: 2.5, relXGFPct: 3.0, defensiveZoneStartPct: 48.0,
        goalsPer60: 0.35, pointsPer60: 1.4, penaltyDifferential: 4,
        pkTOIPerGP: 1.8,
      }),
      contract: makeContract({ aav: 925_000, signingType: "ELC" }),
    };

    const result = calculateValueScore(input);
    // ELC D producing 45+ pts should get strong value with rookie bonus
    expect(result.overall).toBeGreaterThanOrEqual(75);
  });

  // ──────────────────────────────────────────────
  // 13. MacKinnon-type — franchise player on max deal with high win impact
  // Should score Strong Value (70+) because he massively impacts winning
  // ──────────────────────────────────────────────
  it("scores a franchise player like MacKinnon as Strong Value or better", () => {
    const input: ValueInput = {
      player: { position: "C", age: 29 },
      stats: makeSkaterStats({
        gamesPlayed: 82, goals: 51, assists: 89, points: 140,
        plusMinus: 25, toiPerGame: 22.0, shots: 330, shootingPct: 15.5,
        hits: 30, blocks: 18, takeaways: 65, giveaways: 45,
        powerPlayGoals: 16, powerPlayAssists: 30, powerPlayPoints: 46,
        shortHandedGoals: 2, shortHandedAssists: 1, shortHandedPoints: 3,
        evenStrengthGoals: 33, evenStrengthAssists: 58, evenStrengthPoints: 91,
        gameWinningGoals: 12, overtimeGoals: 4,
      }),
      advanced: makeAdvanced({
        corsiForPct: 56.0, xGFPct: 58.0, goalsForPct: 62.0,
        relCorsiForPct: 6.0, relXGFPct: 7.0,
        individualExpectedGoals: 32.0, individualHighDangerChances: 85,
        goalsPer60: 1.6, pointsPer60: 3.6, penaltyDifferential: 10,
      }),
      impact: {
        winPctDifferential: 0.15,
        clutchRating: 72,
        pointsPerGameInWins: 2.1,
        goalsPerGameInWins: 0.8,
        highImpactGames: 22,
        gameScore: 1.5,
      },
      contract: makeContract({ aav: 12_600_000 }),
    };

    const result = calculateValueScore(input);
    // Franchise player who makes team 15% more likely to win = Strong Value minimum
    expect(result.overall).toBeGreaterThanOrEqual(70);
    expect(result.grade).toMatch(/Elite|Great/);

    const c = result.components as ForwardComponents;
    expect(c.winImpact.score).toBeGreaterThan(70);
    expect(c.winImpact.weight).toBe(0.12);
  });

  // ──────────────────────────────────────────────
  // 14. Win impact boosts an already good player
  // ──────────────────────────────────────────────
  it("win impact boosts a good forward from fair to strong value", () => {
    const withoutImpact: ValueInput = {
      player: { position: "C", age: 27 },
      stats: makeSkaterStats({
        gamesPlayed: 80, goals: 35, assists: 45, points: 80,
        plusMinus: 15, toiPerGame: 20.0, shots: 250, shootingPct: 14.0,
        powerPlayGoals: 10, powerPlayAssists: 15, powerPlayPoints: 25,
        shortHandedGoals: 1, shortHandedAssists: 1, shortHandedPoints: 2,
        evenStrengthGoals: 24, evenStrengthAssists: 29, evenStrengthPoints: 53,
        gameWinningGoals: 8, overtimeGoals: 2,
      }),
      advanced: makeAdvanced({
        corsiForPct: 53.0, xGFPct: 54.0, goalsForPct: 56.0,
        relCorsiForPct: 3.0, relXGFPct: 3.5,
        goalsPer60: 1.2, pointsPer60: 2.8,
      }),
      contract: makeContract({ aav: 9_000_000 }),
    };

    const withImpact: ValueInput = {
      ...withoutImpact,
      impact: {
        winPctDifferential: 0.10,
        clutchRating: 65,
        highImpactGames: 15,
        gameScore: 1.3,
      },
    };

    const resultWithout = calculateValueScore(withoutImpact);
    const resultWith = calculateValueScore(withImpact);

    // Win impact should boost the score
    expect(resultWith.overall).toBeGreaterThan(resultWithout.overall);
  });

  // ──────────────────────────────────────────────
  // 15. Win impact defaults to average when missing
  // ──────────────────────────────────────────────
  it("defaults win impact to average (50) when no impact data provided", () => {
    const input: ValueInput = {
      player: { position: "C", age: 27 },
      stats: makeSkaterStats(),
      advanced: makeAdvanced(),
      contract: makeContract(),
    };

    const result = calculateValueScore(input);
    const c = result.components as ForwardComponents;
    expect(c.winImpact.score).toBe(50);
  });

  // ──────────────────────────────────────────────
  // Structural tests
  // ──────────────────────────────────────────────
  it("returns score between 1 and 99", () => {
    const input: ValueInput = {
      player: { position: "C", age: 27 },
      stats: makeSkaterStats(),
      contract: makeContract(),
    };
    const result = calculateValueScore(input);
    expect(result.overall).toBeGreaterThanOrEqual(1);
    expect(result.overall).toBeLessThanOrEqual(99);
  });

  it("component weights sum to 1.0 for forwards", () => {
    const input: ValueInput = {
      player: { position: "C", age: 27 },
      stats: makeSkaterStats(),
      advanced: makeAdvanced(),
      contract: makeContract(),
    };
    const result = calculateValueScore(input);
    const sum = Object.values(result.components).reduce(
      (s, c) => s + (c as any).weight,
      0,
    );
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("component weights sum to 1.0 for defensemen", () => {
    const input: ValueInput = {
      player: { position: "D", age: 25 },
      stats: makeSkaterStats({ toiPerGame: 22.0, blocks: 80 }),
      advanced: makeAdvanced(),
      contract: makeContract(),
    };
    const result = calculateValueScore(input);
    const sum = Object.values(result.components).reduce(
      (s, c) => s + (c as any).weight,
      0,
    );
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("component weights sum to 1.0 for goalies", () => {
    const input: ValueInput = {
      player: { position: "G", age: 28 },
      goalie: makeGoalieStats(),
      contract: makeContract(),
    };
    const result = calculateValueScore(input);
    const sum = Object.values(result.components).reduce(
      (s, c) => s + (c as any).weight,
      0,
    );
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("handles missing advanced stats gracefully", () => {
    const input: ValueInput = {
      player: { position: "C", age: 27 },
      stats: makeSkaterStats(),
      contract: makeContract(),
      // No advanced stats
    };
    const result = calculateValueScore(input);
    expect(result.overall).toBeGreaterThanOrEqual(1);

    const c = result.components as ForwardComponents;
    // Should default to 50 (league average) when missing
    expect(c.fiveOnFiveImpact.score).toBe(50);
  });

  it("uses birthDate when age is not directly provided", () => {
    const input: ValueInput = {
      player: { position: "LW", birthDate: "1997-04-26" }, // ~28 years old
      stats: makeSkaterStats(),
      contract: makeContract(),
    };
    const result = calculateValueScore(input);
    expect(result.meta.age).toBeGreaterThanOrEqual(27);
    expect(result.meta.age).toBeLessThanOrEqual(29);
  });
});
