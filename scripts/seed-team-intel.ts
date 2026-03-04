// ──────────────────────────────────────────────
// Roster Matrix — Seed Team Intel (Transactions, Injuries, Draft Picks)
// Run: npx tsx scripts/seed-team-intel.ts
// ──────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Deterministic PRNG (same as main seed) ──

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickN<T>(arr: T[], n: number, rng: () => number): T[] {
  const shuffled = [...arr].sort(() => rng() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randInt(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randDate(start: Date, end: Date, rng: () => number): Date {
  const t = start.getTime() + rng() * (end.getTime() - start.getTime());
  return new Date(t);
}

// ── Team abbreviation list (must match seed-data.ts order) ──

const TEAM_ABBREVS = [
  "ANA", "BOS", "BUF", "CGY", "CAR", "CHI", "COL", "CBJ",
  "DAL", "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NSH",
  "NJD", "NYI", "NYR", "OTT", "PHI", "PIT", "SJS", "SEA",
  "STL", "TBL", "TOR", "UTA", "VAN", "VGK", "WPG", "WSH",
];

// ── Contending vs rebuilding teams (for draft pick trade patterns) ──

const CONTENDERS_LIST = [
  "EDM", "COL", "FLA", "DAL", "WPG", "CAR", "VGK", "TOR",
  "BOS", "NYR", "TBL", "MIN", "LAK", "WSH",
];
const REBUILDERS_LIST = [
  "ANA", "CHI", "SJS", "CBJ", "BUF", "MTL", "PHI", "UTA",
];
const CONTENDERS = new Set(CONTENDERS_LIST);
const REBUILDERS = new Set(REBUILDERS_LIST);

// ── Fictional player names for transactions ──

const FORWARD_NAMES = [
  "Jake Morrison", "Tyler Bennett", "Marcus Johansson", "Kyle Anderson",
  "Nate Fischer", "Ryan Stanton", "Matt Eriksson", "Chris Nilsson",
  "Sam Decker", "Alex Nordstrom", "Danny Park", "Ian Wright",
  "Luke Patterson", "Josh Lindgren", "Evan Kelly", "Owen Murray",
  "Ben Torres", "Liam Reeves", "Dylan Marsh", "Connor Voss",
];

const DEFENSE_NAMES = [
  "Adam Blake", "Eric Svensson", "Noah Grant", "James Kowalski",
  "Mike Sorensen", "Derek Holt", "Brandon Kerr", "Scott Lindberg",
  "Travis Moore", "Sean Murphy", "Jake Olsen", "Nick Petrov",
];

const GOALIE_NAMES = [
  "Mikael Strand", "Jake Hartley", "Patrick Lindqvist", "Tom Bower",
];

// ── Transaction templates ──

function generateTransactions(
  teamIdx: number,
  teamId: string,
  teamAbbrev: string,
  allTeams: { id: string; abbreviation: string }[],
  rng: () => number,
) {
  const count = randInt(5, 8, rng);
  const dateStart = new Date("2025-11-01");
  const dateEnd = new Date("2026-02-23");
  const otherTeams = allTeams.filter((t) => t.abbreviation !== teamAbbrev);
  const txns: {
    teamId: string;
    type: "TRADE" | "SIGNING" | "WAIVER" | "RECALL";
    description: string;
    playersInvolved: { name: string; direction: "in" | "out" }[];
    date: Date;
  }[] = [];

  for (let i = 0; i < count; i++) {
    const roll = rng();
    const date = randDate(dateStart, dateEnd, rng);
    const other = pick(otherTeams, rng);

    if (roll < 0.3) {
      // TRADE
      const tradeRoll = rng();
      if (tradeRoll < 0.5) {
        const pName = pick(FORWARD_NAMES, rng);
        const desc = `Acquired F ${pName} from ${other.abbreviation} for 2026 ${pick(["3rd", "4th", "5th"], rng)}-round pick`;
        txns.push({
          teamId, type: "TRADE", description: desc, date,
          playersInvolved: [{ name: pName, direction: "in" }],
        });
      } else {
        const pOut = pick(DEFENSE_NAMES, rng);
        const pIn = pick(FORWARD_NAMES, rng);
        const desc = `Traded D ${pOut} to ${other.abbreviation} for F ${pIn} and 2027 ${pick(["5th", "6th", "7th"], rng)}-round pick`;
        txns.push({
          teamId, type: "TRADE", description: desc, date,
          playersInvolved: [
            { name: pOut, direction: "out" },
            { name: pIn, direction: "in" },
          ],
        });
      }
    } else if (roll < 0.55) {
      // SIGNING
      const sigRoll = rng();
      if (sigRoll < 0.6) {
        const pName = pick(FORWARD_NAMES, rng);
        const years = pick([1, 2, 3], rng);
        const aav = (randInt(10, 80, rng) / 10).toFixed(2);
        const desc = `Signed F ${pName} to a ${years}-year, $${aav}M AAV extension`;
        txns.push({
          teamId, type: "SIGNING", description: desc, date,
          playersInvolved: [{ name: pName, direction: "in" }],
        });
      } else {
        const pName = pick(GOALIE_NAMES, rng);
        const aav = (randInt(10, 45, rng) / 10).toFixed(2);
        const desc = `Signed G ${pName} to a 1-year, $${aav}M contract`;
        txns.push({
          teamId, type: "SIGNING", description: desc, date,
          playersInvolved: [{ name: pName, direction: "in" }],
        });
      }
    } else if (roll < 0.8) {
      // WAIVER
      const waiverRoll = rng();
      if (waiverRoll < 0.5) {
        const pName = pick(FORWARD_NAMES, rng);
        const desc = `Placed F ${pName} on waivers`;
        txns.push({
          teamId, type: "WAIVER", description: desc, date,
          playersInvolved: [{ name: pName, direction: "out" }],
        });
      } else {
        const pName = pick(DEFENSE_NAMES, rng);
        const desc = `Claimed D ${pName} off waivers from ${other.abbreviation}`;
        txns.push({
          teamId, type: "WAIVER", description: desc, date,
          playersInvolved: [{ name: pName, direction: "in" }],
        });
      }
    } else {
      // RECALL
      const recallRoll = rng();
      if (recallRoll < 0.5) {
        const pName = pick(FORWARD_NAMES, rng);
        const desc = `Recalled F ${pName} from AHL affiliate`;
        txns.push({
          teamId, type: "RECALL", description: desc, date,
          playersInvolved: [{ name: pName, direction: "in" }],
        });
      } else {
        const pName = pick(DEFENSE_NAMES, rng);
        const desc = `Assigned D ${pName} to AHL affiliate`;
        txns.push({
          teamId, type: "RECALL", description: desc, date,
          playersInvolved: [{ name: pName, direction: "out" }],
        });
      }
    }
  }

  return txns;
}

// ── Injury generation using real players ──

interface PlayerInfo {
  id: string;
  fullName: string;
  position: string;
}

function generateInjuries(
  teamIdx: number,
  teamId: string,
  players: PlayerInfo[],
  rng: () => number,
) {
  const count = randInt(2, 4, rng);
  const selected = pickN(players, count, rng);
  const now = new Date("2026-02-23");

  const injuryPool: {
    type: "DAY_TO_DAY" | "IR" | "LTIR" | "OUT";
    descriptions: string[];
    returnDays: [number, number] | null;
  }[] = [
    {
      type: "DAY_TO_DAY",
      descriptions: ["Upper-body injury", "Lower-body injury"],
      returnDays: [3, 7],
    },
    {
      type: "IR",
      descriptions: ["Knee sprain", "Shoulder injury", "Concussion protocol"],
      returnDays: [14, 28],
    },
    {
      type: "LTIR",
      descriptions: ["ACL tear", "Broken wrist", "Herniated disc"],
      returnDays: [60, 120],
    },
    {
      type: "OUT",
      descriptions: ["Back surgery — season-ending", "Torn ACL — out for season"],
      returnDays: null,
    },
  ];

  return selected.map((player) => {
    const injuryDef = pick(injuryPool, rng);
    const description = pick(injuryDef.descriptions, rng);
    const daysAgo = randInt(1, 21, rng);
    const injuryDate = new Date(now.getTime() - daysAgo * 86400000);

    let expectedReturn: Date | null = null;
    if (injuryDef.returnDays) {
      const returnInDays = randInt(injuryDef.returnDays[0], injuryDef.returnDays[1], rng);
      expectedReturn = new Date(now.getTime() + returnInDays * 86400000);
    }

    return {
      playerId: player.id,
      teamId,
      type: injuryDef.type,
      description,
      date: injuryDate,
      expectedReturn,
    };
  });
}

// ── Draft pick generation ──

function generateDraftPicks(
  allTeams: { id: string; abbreviation: string }[],
  rng: () => number,
) {
  const teamIdByAbbrev = new Map(allTeams.map((t) => [t.abbreviation, t.id]));
  const picks: {
    teamId: string;
    originalTeamId: string;
    year: number;
    round: number;
    condition: string | null;
  }[] = [];

  // Pre-compute trades: for each year, some picks change hands
  const tradeMap = new Map<string, string>(); // "origTeamId-year-round" -> new owner teamId
  const conditions = new Map<string, string>();

  for (const year of [2025, 2026, 2027]) {
    for (let teamIdx = 0; teamIdx < TEAM_ABBREVS.length; teamIdx++) {
      const abbrev = TEAM_ABBREVS[teamIdx];
      const origTeamId = teamIdByAbbrev.get(abbrev)!;
      const isContender = CONTENDERS.has(abbrev);
      const isRebuilder = REBUILDERS.has(abbrev);

      for (let round = 1; round <= 7; round++) {
        const key = `${origTeamId}-${year}-${round}`;
        const tradeChance = rng();

        // ~30% of picks get traded
        if (tradeChance < 0.3) {
          if (isContender && round <= 3) {
            // Contenders trade away early picks to rebuilders
            const targetAbbrev = pick(REBUILDERS_LIST, rng);
            const targetTeamId = teamIdByAbbrev.get(targetAbbrev)!;
            tradeMap.set(key, targetTeamId);
          } else if (isRebuilder && round >= 4) {
            // Rebuilders trade late picks to contenders
            const targetAbbrev = pick(CONTENDERS_LIST, rng);
            const targetTeamId = teamIdByAbbrev.get(targetAbbrev)!;
            tradeMap.set(key, targetTeamId);
          } else {
            // Random trade between any two teams
            const otherTeams = allTeams.filter((t) => t.abbreviation !== abbrev);
            const target = pick(otherTeams, rng);
            tradeMap.set(key, target.id);
          }

          // Some traded picks have conditions
          const condRoll = rng();
          if (condRoll < 0.15 && round === 1) {
            conditions.set(key, "Top-10 protected");
          } else if (condRoll < 0.25 && round <= 3) {
            conditions.set(key, "Lottery protected");
          } else if (condRoll < 0.35) {
            conditions.set(key, "Conditional on playoff appearance");
          }
        }
      }
    }
  }

  // Build all picks
  for (const year of [2025, 2026, 2027]) {
    for (const team of allTeams) {
      for (let round = 1; round <= 7; round++) {
        const key = `${team.id}-${year}-${round}`;
        const ownerId = tradeMap.get(key) ?? team.id;
        picks.push({
          teamId: ownerId,
          originalTeamId: team.id,
          year,
          round,
          condition: conditions.get(key) ?? null,
        });
      }
    }
  }

  return picks;
}

// ── Main ──

async function main() {
  console.log("🏒 Roster Matrix — Seeding Team Intel data...\n");

  // 1. Clear existing data
  console.log("  Clearing existing Transaction, Injury, DraftPick data...");
  await prisma.transaction.deleteMany();
  await prisma.injury.deleteMany();
  await prisma.draftPick.deleteMany();

  // 2. Fetch all teams
  const allTeams = await prisma.team.findMany({
    select: { id: true, abbreviation: true },
  });
  console.log(`  Found ${allTeams.length} teams`);

  if (allTeams.length === 0) {
    console.error("  ❌ No teams found. Run the main seed first.");
    process.exit(1);
  }

  // Build lookup by abbreviation
  const teamByAbbrev = new Map(allTeams.map((t) => [t.abbreviation, t]));

  // 3. Seed Transactions
  console.log("  Creating transactions...");
  let txnCount = 0;

  for (let i = 0; i < TEAM_ABBREVS.length; i++) {
    const abbrev = TEAM_ABBREVS[i];
    const team = teamByAbbrev.get(abbrev);
    if (!team) continue;

    const rng = seededRandom(42000 + i);
    const txns = generateTransactions(i, team.id, abbrev, allTeams, rng);

    for (const txn of txns) {
      await prisma.transaction.create({
        data: {
          teamId: txn.teamId,
          type: txn.type,
          description: txn.description,
          playersInvolved: txn.playersInvolved,
          date: txn.date,
        },
      });
      txnCount++;
    }
  }
  console.log(`  ✅ Transactions: ${txnCount}`);

  // 4. Seed Injuries (using real players from DB)
  console.log("  Creating injuries...");
  let injuryCount = 0;

  for (let i = 0; i < TEAM_ABBREVS.length; i++) {
    const abbrev = TEAM_ABBREVS[i];
    const team = teamByAbbrev.get(abbrev);
    if (!team) continue;

    const rng = seededRandom(84000 + i);

    // Fetch real players for this team
    const players = await prisma.player.findMany({
      where: { currentTeamId: team.id },
      select: { id: true, fullName: true, position: true },
      take: 10,
    });

    if (players.length === 0) continue;

    const injuries = generateInjuries(i, team.id, players, rng);

    for (const inj of injuries) {
      await prisma.injury.create({
        data: {
          playerId: inj.playerId,
          teamId: inj.teamId,
          type: inj.type,
          description: inj.description,
          date: inj.date,
          expectedReturn: inj.expectedReturn,
        },
      });
      injuryCount++;
    }
  }
  console.log(`  ✅ Injuries: ${injuryCount}`);

  // 5. Seed Draft Picks
  console.log("  Creating draft picks (2025-2027, rounds 1-7)...");
  const globalRng = seededRandom(99999);
  const draftPicks = generateDraftPicks(allTeams, globalRng);

  for (const dp of draftPicks) {
    await prisma.draftPick.create({
      data: {
        teamId: dp.teamId,
        originalTeamId: dp.originalTeamId,
        year: dp.year,
        round: dp.round,
        condition: dp.condition,
      },
    });
  }
  console.log(`  ✅ Draft picks: ${draftPicks.length}`);

  // Summary
  const txnTotal = await prisma.transaction.count();
  const injTotal = await prisma.injury.count();
  const dpTotal = await prisma.draftPick.count();

  console.log("\n✅ Team Intel seed complete!");
  console.log(`   Transactions:  ${txnTotal}`);
  console.log(`   Injuries:      ${injTotal}`);
  console.log(`   Draft Picks:   ${dpTotal}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
