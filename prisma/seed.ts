// ──────────────────────────────────────────────
// Roster Matrix — Prisma Seed Script
// Seeds 32 teams, 700+ players, real stats from NHL API
// ──────────────────────────────────────────────

import { PrismaClient, Prisma, ContractStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  TEAMS, SKATERS, GOALIES,
  type ContractInfo,
} from "./seed-data";
import contractsLookupRaw from "./contracts-lookup.json";
import { syncAllStats, createHistoricalContracts } from "../src/server/services/stats-sync";
import { syncImpactStats } from "../src/server/services/impact-sync";
import { calculateAllValueScores } from "../src/server/services/value-batch";

const contractsLookup = contractsLookupRaw as {
  teams: Record<string, { name: string; capHit: number; endYear: number; startYear?: number; status: string }[]>;
};

const prisma = new PrismaClient();

// ── Deterministic PRNG ──

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function dec(val: number, places = 2): Prisma.Decimal {
  return new Prisma.Decimal(val.toFixed(places));
}

function deriveContractStatus(startYear: number, endYear: number): ContractStatus {
  if (startYear > 2025) return "FUTURE";
  if (endYear < 2026) return "EXPIRED";
  return "ACTIVE";
}

// ── Contract cap-hit helper ──

function buildCapHit(ct: ContractInfo): Record<string, number> {
  const term = ct.endYear - ct.startYear;
  const hits: Record<string, number> = {};
  for (let y = ct.startYear; y < ct.endYear; y++) {
    const label = `${y}-${String(y + 1).slice(2)}`;
    if (ct.structure === "FRONT_LOADED" && term > 2) {
      const i = y - ct.startYear;
      hits[label] = Math.round(ct.aav * (1 + 0.15 * (1 - (2 * i) / (term - 1))) * 1000000) / 1000000;
    } else {
      hits[label] = ct.aav;
    }
  }
  return hits;
}

// ── Main seed ──

async function main() {
  console.log("🏒 Roster Matrix — Seeding database...\n");

  // ── 1. Clear tables ──
  console.log("  Clearing existing data...");
  await prisma.analyticsEvent.deleteMany();
  await prisma.draftPick.deleteMany();
  await prisma.injury.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.tradeScenario.deleteMany();
  await prisma.savedReport.deleteMany();
  await prisma.playerImpactStats.deleteMany();
  await prisma.playerValueScore.deleteMany();
  await prisma.goalieStats.deleteMany();
  await prisma.advancedStats.deleteMany();
  await prisma.seasonStats.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.player.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.jobRun.deleteMany();
  await prisma.team.deleteMany();

  // ── 2. Create teams ──
  console.log("  Creating 32 teams...");
  const teamMap = new Map<string, string>();
  for (const t of TEAMS) {
    const team = await prisma.team.create({
      data: {
        nhlApiId: t.nhlApiId,
        name: t.name,
        abbreviation: t.abbrev,
        city: t.city,
        division: t.division,
        conference: t.conference,
        primaryColor: t.primaryColor,
        secondaryColor: t.secondaryColor,
      },
    });
    teamMap.set(t.abbrev, team.id);
  }

  // ── 3. Admin user ──
  console.log("  Creating admin user...");
  await prisma.user.create({
    data: {
      email: "admin@rostermatrix.app",
      name: "Admin",
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });

  // ── 4. Create named skaters ──
  console.log(`  Creating ${SKATERS.length} named skaters...`);
  const teamPlayerCount = new Map<string, number>();

  for (const s of SKATERS) {
    const teamId = teamMap.get(s.teamAbbrev)!;

    const player = await prisma.player.create({
      data: {
        nhlApiId: s.nhlApiId,
        firstName: s.firstName,
        lastName: s.lastName,
        fullName: `${s.firstName} ${s.lastName}`,
        position: s.position,
        shootsCatches: s.shootsCatches,
        birthDate: new Date(s.birthDate),
        birthCity: s.birthCity,
        birthCountry: s.birthCountry,
        heightInches: s.heightInches,
        weightLbs: s.weightLbs,
        isActive: true,
        currentTeamId: teamId,
      },
    });

    // Contract
    const ct = s.contract;
    const term = ct.endYear - ct.startYear;
    await prisma.contract.create({
      data: {
        playerId: player.id, teamId,
        startYear: ct.startYear, endYear: ct.endYear, totalYears: term,
        aav: dec(ct.aav * 1000000), totalValue: dec(ct.aav * term * 1000000),
        structure: ct.structure, capHitByYear: buildCapHit(ct),
        signingAge: ct.signingAge,
        hasNTC: ct.hasNTC, hasNMC: ct.hasNMC,
        tradeProtectionDetails: ct.tradeProtection ?? null,
        signingType: ct.signingType, status: deriveContractStatus(ct.startYear, ct.endYear), source: "seed",
      },
    });

    teamPlayerCount.set(s.teamAbbrev, (teamPlayerCount.get(s.teamAbbrev) ?? 0) + 1);
  }

  // ── 5. Create named goalies ──
  console.log(`  Creating ${GOALIES.length} named goalies...`);

  for (const g of GOALIES) {
    const teamId = teamMap.get(g.teamAbbrev)!;

    const player = await prisma.player.create({
      data: {
        nhlApiId: g.nhlApiId,
        firstName: g.firstName,
        lastName: g.lastName,
        fullName: `${g.firstName} ${g.lastName}`,
        position: "G",
        shootsCatches: g.shootsCatches,
        birthDate: new Date(g.birthDate),
        birthCity: g.birthCity,
        birthCountry: g.birthCountry,
        heightInches: g.heightInches,
        weightLbs: g.weightLbs,
        isActive: true,
        currentTeamId: teamId,
      },
    });

    // Contract
    const ct = g.contract;
    const term = ct.endYear - ct.startYear;
    await prisma.contract.create({
      data: {
        playerId: player.id, teamId: teamMap.get(g.teamAbbrev)!,
        startYear: ct.startYear, endYear: ct.endYear, totalYears: term,
        aav: dec(ct.aav * 1000000), totalValue: dec(ct.aav * term * 1000000),
        structure: ct.structure, capHitByYear: buildCapHit(ct),
        signingAge: ct.signingAge,
        hasNTC: ct.hasNTC, hasNMC: ct.hasNMC,
        tradeProtectionDetails: ct.tradeProtection ?? null,
        signingType: ct.signingType, status: deriveContractStatus(ct.startYear, ct.endYear), source: "seed",
      },
    });

    teamPlayerCount.set(g.teamAbbrev, (teamPlayerCount.get(g.teamAbbrev) ?? 0) + 1);
  }

  // ── 6. Sync real players from NHL API ──
  console.log("  Fetching real NHL rosters from API...");

  const NHL_API = "https://api-web.nhle.com/v1";
  const seededNhlApiIds = new Set<number>([
    ...SKATERS.map((s) => s.nhlApiId),
    ...GOALIES.map((g) => g.nhlApiId),
  ]);

  type RosterPlayer = {
    id: number;
    headshot: string;
    firstName: { default: string };
    lastName: { default: string };
    positionCode: string;
    shootsCatches: string;
    heightInInches: number;
    weightInPounds: number;
    birthDate: string;
    birthCity: { default: string };
    birthCountry: string;
  };

  function mapPos(code: string): "C" | "LW" | "RW" | "D" | "G" {
    switch (code) {
      case "C": return "C";
      case "L": return "LW";
      case "R": return "RW";
      case "D": return "D";
      case "G": return "G";
      default: return "C";
    }
  }

  let apiPlayerCount = 0;
  let apiErrors = 0;

  for (let ti = 0; ti < TEAMS.length; ti++) {
    const t = TEAMS[ti];
    if (ti > 0) await new Promise((r) => setTimeout(r, 3000)); // rate-limit delay
    const teamId = teamMap.get(t.abbrev)!;
    let roster: { forwards: RosterPlayer[]; defensemen: RosterPlayer[]; goalies: RosterPlayer[] };

    try {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 5000 * attempt));
        res = await fetch(`${NHL_API}/roster/${t.abbrev}/current`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) break;
        if (res.status === 429) {
          console.warn(`  ⚠ Rate limited for ${t.abbrev}, retrying (attempt ${attempt + 1}/3)...`);
          continue;
        }
        if (res.status === 307 || res.status === 308) {
          const loc = res.headers.get("location");
          if (loc) {
            res = await fetch(loc, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
            if (res.ok) break;
          }
        }
        break;
      }
      if (!res || !res.ok) {
        throw new Error(`HTTP ${res?.status ?? 'unknown'} for ${t.abbrev}`);
      }
      roster = await res.json();
    } catch (err) {
      console.warn(`  ⚠ Failed to fetch roster for ${t.abbrev}: ${err instanceof Error ? err.message : err}`);
      apiErrors++;
      continue;
    }

    const allPlayers: RosterPlayer[] = [
      ...(roster.forwards ?? []),
      ...(roster.defensemen ?? []),
      ...(roster.goalies ?? []),
    ];

    for (const rp of allPlayers) {
      if (!rp.id || seededNhlApiIds.has(rp.id)) continue;

      const firstName = rp.firstName?.default ?? "Unknown";
      const lastName = rp.lastName?.default ?? "Unknown";
      const position = mapPos(rp.positionCode);
      const birthYear = rp.birthDate ? parseInt(rp.birthDate.slice(0, 4), 10) : 1998;
      const age2025 = 2025 - birthYear;

      const player = await prisma.player.upsert({
        where: { nhlApiId: rp.id },
        create: {
          nhlApiId: rp.id,
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`,
          position,
          shootsCatches: rp.shootsCatches ?? "L",
          birthDate: rp.birthDate ? new Date(rp.birthDate) : null,
          birthCity: rp.birthCity?.default ?? null,
          birthCountry: rp.birthCountry ?? null,
          heightInches: rp.heightInInches ?? null,
          weightLbs: rp.weightInPounds ?? null,
          isActive: true,
          headshotUrl: rp.headshot ?? null,
          currentTeamId: teamId,
        },
        update: {
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`,
          position,
          isActive: true,
          headshotUrl: rp.headshot ?? null,
          currentTeamId: teamId,
        },
      });

      // Look up real contract data from PuckPedia
      const fullName = `${firstName} ${lastName}`;
      const lookupTeam = contractsLookup.teams[t.abbrev];
      const lookupEntries = lookupTeam?.filter(p => p.name.toLowerCase() === fullName.toLowerCase()) ?? [];

      if (lookupEntries.length > 0) {
        for (const lookupEntry of lookupEntries) {
          const totalYears = lookupEntry.startYear
            ? Math.max(1, lookupEntry.endYear - lookupEntry.startYear)
            : Math.max(1, lookupEntry.endYear - 2025);
          const sYear = lookupEntry.startYear ?? lookupEntry.endYear - totalYears;
          const aavM = lookupEntry.capHit / 1000000;
          const sigType = age2025 <= 22 ? "ELC" as const : lookupEntry.status === "RFA" ? "RFA" as const : "UFA" as const;
          const ct: ContractInfo = {
            startYear: sYear, endYear: lookupEntry.endYear, aav: aavM,
            structure: totalYears <= 2 ? "FLAT" : "EVEN",
            signingType: sigType,
            hasNTC: lookupEntry.capHit >= 5000000 && totalYears >= 4,
            hasNMC: lookupEntry.capHit >= 8000000 && totalYears >= 5,
            signingAge: Math.max(18, age2025 - (2025 - sYear)),
          };

          const termLen = ct.endYear - ct.startYear;
          await prisma.contract.create({
            data: {
              playerId: player.id, teamId,
              startYear: ct.startYear, endYear: ct.endYear, totalYears: termLen,
              aav: dec(ct.aav * 1000000), totalValue: dec(ct.aav * termLen * 1000000),
              structure: ct.structure, capHitByYear: buildCapHit(ct),
              signingAge: ct.signingAge,
              hasNTC: ct.hasNTC, hasNMC: ct.hasNMC,
              signingType: ct.signingType, status: deriveContractStatus(ct.startYear, ct.endYear), source: "puckpedia",
            },
          });
        }
      } else {
        // Fallback: minimal contract for players not in PuckPedia lookup
        const isELC = age2025 <= 22;
        const rng = seededRandom(rp.id);
        let aavM: number;
        let sigType: "ELC" | "UFA" | "RFA";
        let termBase: number;
        let sYear: number;

        if (isELC) {
          aavM = 0.925; sigType = "ELC" as const; termBase = 3;
          sYear = 2023 + Math.round(rng());
        } else {
          aavM = 1.0 + rng() * 2.0;
          sigType = age2025 <= 25 ? "RFA" as const : "UFA" as const;
          termBase = 1 + Math.round(rng() * 2);
          sYear = 2023 + Math.round(rng());
        }
        aavM = Math.round(aavM * 1000) / 1000;
        const ct: ContractInfo = {
          startYear: sYear, endYear: sYear + termBase, aav: aavM,
          structure: termBase <= 2 ? "FLAT" : "EVEN",
          signingType: sigType,
          hasNTC: false,
          hasNMC: false,
          signingAge: Math.max(18, age2025 - (2025 - sYear)),
        };

        const termLen = ct.endYear - ct.startYear;
        await prisma.contract.create({
          data: {
            playerId: player.id, teamId,
            startYear: ct.startYear, endYear: ct.endYear, totalYears: termLen,
            aav: dec(ct.aav * 1000000), totalValue: dec(ct.aav * termLen * 1000000),
            structure: ct.structure, capHitByYear: buildCapHit(ct),
            signingAge: ct.signingAge,
            hasNTC: ct.hasNTC, hasNMC: ct.hasNMC,
            signingType: ct.signingType, status: deriveContractStatus(ct.startYear, ct.endYear), source: "generated-fallback",
          },
        });
      }

      apiPlayerCount++;
    }

    console.log(`    ${t.abbrev}: +${allPlayers.filter((p) => p.id && !seededNhlApiIds.has(p.id)).length} players from API`);
    // Small delay to be polite to the API
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`  NHL API sync: ${apiPlayerCount} real players added (${apiErrors} team fetch errors)`);

  // ── 7. Sync real stats from NHL API ──
  console.log("\n  Syncing real stats from NHL API (this may take several minutes)...");
  const statsResult = await syncAllStats(prisma);
  console.log(`  Stats sync complete:`);
  console.log(`    Players processed:    ${statsResult.playersProcessed}`);
  console.log(`    Skater seasons:       ${statsResult.skaterSeasonsCreated}`);
  console.log(`    Goalie seasons:       ${statsResult.goalieSeasonsCreated}`);
  console.log(`    Advanced stats:       ${statsResult.advancedStatsCreated}`);
  console.log(`    Value scores:         ${statsResult.valueScoresCreated}`);
  if (statsResult.errors.length > 0) {
    console.log(`    Errors:               ${statsResult.errors.length}`);
    for (const err of statsResult.errors.slice(0, 10)) {
      console.log(`      - ${err}`);
    }
  }

  // ── 7b. Sync impact stats from NHL API ──
  console.log("\n  Syncing impact stats from NHL API (game-by-game data)...");
  const impactResult = await syncImpactStats(prisma);
  console.log(`  Impact sync complete:`);
  console.log(`    Players processed:    ${impactResult.playersProcessed}`);
  console.log(`    Stats created:        ${impactResult.statsCreated}`);
  if (impactResult.errors.length > 0) {
    console.log(`    Errors:               ${impactResult.errors.length}`);
    for (const err of impactResult.errors.slice(0, 5)) {
      console.log(`      - ${err}`);
    }
  }

  // ── 7c. Recalculate all value scores using the real engine ──
  console.log("\n  Recalculating value scores with calibrated engine...");
  const batchResult = await calculateAllValueScores();
  console.log(`  Value score recalculation complete:`);
  console.log(`    Processed: ${batchResult.processed}`);
  console.log(`    Skipped:   ${batchResult.skipped}`);
  console.log(`    Failed:    ${batchResult.failed}`);
  console.log(`    Duration:  ${batchResult.durationMs}ms`);

  // ── 8. Create historical contracts ──
  console.log("\n  Creating historical contracts for uncovered seasons...");
  const historicalContracts = await createHistoricalContracts(prisma);
  console.log(`  Historical contracts created: ${historicalContracts}`);

  // ── 8b. Apply future contracts from lookup to all players ──
  console.log("  Applying future contracts from lookup...");
  let futureCreated = 0;
  for (const [teamAbbrev, entries] of Object.entries(contractsLookup.teams)) {
    const futureEntries = entries.filter((e: { startYear?: number }) => e.startYear && e.startYear > 2025);
    if (futureEntries.length === 0) continue;

    const tid = teamMap.get(teamAbbrev);
    if (!tid) continue;

    for (const entry of futureEntries) {
      const player = await prisma.player.findFirst({
        where: { fullName: { equals: entry.name, mode: "insensitive" } },
        select: { id: true, currentTeamId: true, birthDate: true },
      });
      if (!player) continue;

      // Check if this future contract already exists
      const existing = await prisma.contract.findFirst({
        where: {
          playerId: player.id,
          startYear: entry.startYear!,
        },
      });
      if (existing) continue;

      const totalYears = Math.max(1, entry.endYear - entry.startYear!);
      const age = player.birthDate
        ? entry.startYear! - player.birthDate.getFullYear()
        : 27;
      await prisma.contract.create({
        data: {
          playerId: player.id,
          teamId: player.currentTeamId ?? tid,
          startYear: entry.startYear!,
          endYear: entry.endYear,
          totalYears,
          aav: dec(entry.capHit),
          totalValue: dec(entry.capHit * totalYears),
          structure: totalYears <= 2 ? "FLAT" : "EVEN",
          capHitByYear: Object.fromEntries(
            Array.from({ length: totalYears }, (_, i) => [
              `${entry.startYear! + i}-${String(entry.startYear! + i + 1).slice(2)}`,
              entry.capHit,
            ]),
          ),
          signingAge: age,
          hasNTC: entry.capHit >= 5000000 && totalYears >= 4,
          hasNMC: entry.capHit >= 8000000 && totalYears >= 5,
          signingType: age <= 26 ? "RFA" : "UFA",
          status: "FUTURE",
          source: "puckpedia-future",
        },
      });
      futureCreated++;
    }
  }
  console.log(`  Future contracts created: ${futureCreated}`);

  // ── 8c. Reconcile named skater contracts with lookup data ──
  console.log("  Reconciling named skater contracts with lookup data...");
  let reconciled = 0;
  for (const [teamAbbrev, entries] of Object.entries(contractsLookup.teams)) {
    const tid = teamMap.get(teamAbbrev);
    if (!tid) continue;

    // Only process current contracts (not future ones)
    const currentEntries = entries.filter((e: { startYear?: number }) => !e.startYear || e.startYear <= 2025);

    for (const entry of currentEntries) {
      const player = await prisma.player.findFirst({
        where: { fullName: { equals: entry.name, mode: "insensitive" } },
        select: { id: true },
      });
      if (!player) continue;

      // Check if player already has a puckpedia contract covering current season
      const existingPuckpedia = await prisma.contract.findFirst({
        where: {
          playerId: player.id,
          source: "puckpedia",
          status: "ACTIVE",
          startYear: { lte: 2025 },
          endYear: { gte: 2026 },
        },
      });
      if (existingPuckpedia) continue; // Already has correct contract

      // Find any seed/fallback contract to replace
      const seedContract = await prisma.contract.findFirst({
        where: {
          playerId: player.id,
          source: { in: ["seed", "generated-fallback"] },
          status: "ACTIVE",
        },
        orderBy: { startYear: "desc" },
      });

      if (seedContract) {
        const lookupAav = entry.capHit;
        const currentAav = Number(seedContract.aav);

        if (Math.abs(currentAav - lookupAav) > 100) {
          // AAV differs meaningfully — update the contract
          const totalYears = entry.endYear - (seedContract.startYear ?? 2025);
          await prisma.contract.update({
            where: { id: seedContract.id },
            data: {
              aav: new Prisma.Decimal(lookupAav),
              totalValue: new Prisma.Decimal(lookupAav * Math.max(1, totalYears)),
              endYear: entry.endYear,
              source: "puckpedia",
            },
          });
          reconciled++;
        }
      }
    }
  }
  console.log(`  Contracts reconciled: ${reconciled}`);

  // ── 9. Demo user + demo data ──
  console.log("  Creating demo user and demo data...");

  const demoPasswordHash = await bcrypt.hash("demo2025", 10);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@rostermatrix.app" },
    update: { passwordHash: demoPasswordHash },
    create: {
      email: "demo@rostermatrix.app",
      name: "Demo User",
      passwordHash: demoPasswordHash,
      role: "ANALYST",
      emailVerified: new Date(),
    },
  });

  // Find interesting players for demo data by name
  const findPlayer = async (fullName: string) => {
    return prisma.player.findFirst({ where: { fullName }, select: { id: true, fullName: true } });
  };

  const mcdavid = await findPlayer("Connor McDavid");
  const makar = await findPlayer("Cale Makar");
  const matthews = await findPlayer("Auston Matthews");
  const celebrini = await findPlayer("Macklin Celebrini");
  const raymond = await findPlayer("Lucas Raymond");
  const huberdeau = await findPlayer("Jonathan Huberdeau");
  const kane = await findPlayer("Patrick Kane");
  const kopitar = await findPlayer("Anze Kopitar");
  const petry = await findPlayer("Jeff Petry");
  const chiarot = await findPlayer("Ben Chiarot");
  const hellebuyck = await findPlayer("Connor Hellebuyck");
  const shesterkin = await findPlayer("Igor Shesterkin");
  const draisaitl = await findPlayer("Leon Draisaitl");
  const mackinnon = await findPlayer("Nathan MacKinnon");
  const marner = await findPlayer("Mitch Marner");
  const fantilli = await findPlayer("Adam Fantilli");
  const michkov = await findPlayer("Matvei Michkov");

  // Delete existing demo data to make seeding idempotent
  await prisma.watchListPlayer.deleteMany({ where: { watchList: { userId: demoUser.id } } });
  await prisma.watchList.deleteMany({ where: { userId: demoUser.id } });
  await prisma.tradeScenario.deleteMany({ where: { userId: demoUser.id } });
  await prisma.savedReport.deleteMany({ where: { userId: demoUser.id } });

  // ── Watch Lists ──
  const eliteList = await prisma.watchList.create({
    data: {
      userId: demoUser.id,
      name: "Elite Value Targets",
      description: "Top-tier players delivering exceptional value relative to their contracts",
    },
  });

  const riskList = await prisma.watchList.create({
    data: {
      userId: demoUser.id,
      name: "Overpaid & At Risk",
      description: "Players whose production doesn't justify their cap hit",
    },
  });

  const prospectList = await prisma.watchList.create({
    data: {
      userId: demoUser.id,
      name: "ELC Stars — Next Contract Watch",
      description: "Young players on entry-level contracts approaching big paydays",
    },
  });

  // Add players to Elite Value Targets
  const elitePlayers = [makar, raymond, hellebuyck, mackinnon, draisaitl].filter(Boolean);
  for (const p of elitePlayers) {
    if (!p) continue;
    await prisma.watchListPlayer.create({
      data: { watchListId: eliteList.id, playerId: p.id, scoreWhenAdded: 75 + Math.round(Math.random() * 20) },
    });
  }

  // Add players to Overpaid & At Risk
  const riskPlayers = [huberdeau, kopitar, petry, chiarot].filter(Boolean);
  for (const p of riskPlayers) {
    if (!p) continue;
    await prisma.watchListPlayer.create({
      data: { watchListId: riskList.id, playerId: p.id, scoreWhenAdded: 25 + Math.round(Math.random() * 15) },
    });
  }

  // Add players to ELC Stars
  const prospectPlayers = [celebrini, fantilli, michkov].filter(Boolean);
  for (const p of prospectPlayers) {
    if (!p) continue;
    await prisma.watchListPlayer.create({
      data: { watchListId: prospectList.id, playerId: p.id, scoreWhenAdded: 60 + Math.round(Math.random() * 20) },
    });
  }

  // ── Trade Scenarios ──
  if (mcdavid && marner) {
    await prisma.tradeScenario.create({
      data: {
        userId: demoUser.id,
        name: "Blockbuster: Marner to Colorado",
        description: "Testing a star-for-package deal — Marner's playmaking in Colorado alongside MacKinnon",
        teams: { TOR: "Toronto Maple Leafs", COL: "Colorado Avalanche" },
        playersInvolved: [
          { playerId: marner.id, name: marner.fullName, from: "TOR", to: "COL" },
        ],
        draftPicks: [
          { from: "COL", to: "TOR", year: 2027, round: 1 },
          { from: "COL", to: "TOR", year: 2028, round: 2 },
        ],
        capImpact: {
          TOR: { capRelief: 10550000 },
          COL: { capAdded: 10550000 },
        },
        notes: "Toronto gets cap flexibility and draft capital. Colorado adds an elite playmaker.",
      },
    });
  }

  if (huberdeau && kane) {
    await prisma.tradeScenario.create({
      data: {
        userId: demoUser.id,
        name: "Cap Dump: Huberdeau Salary Offload",
        description: "Calgary moves Huberdeau's $10.5M hit with a sweetener pick",
        teams: { CGY: "Calgary Flames", DET: "Detroit Red Wings" },
        playersInvolved: [
          { playerId: huberdeau.id, name: huberdeau.fullName, from: "CGY", to: "DET" },
        ],
        draftPicks: [
          { from: "CGY", to: "DET", year: 2026, round: 1 },
        ],
        capImpact: {
          CGY: { capRelief: 10500000 },
          DET: { capAdded: 10500000 },
        },
        notes: "Detroit has the cap space and gets a 1st-round pick as sweetener. Calgary clears cap for rebuild.",
      },
    });
  }

  if (kane) {
    await prisma.tradeScenario.create({
      data: {
        userId: demoUser.id,
        name: "Deadline Rental: Kane to Contender",
        description: "Patrick Kane on an expiring deal — perfect deadline rental for a cup push",
        teams: { DET: "Detroit Red Wings", WPG: "Winnipeg Jets" },
        playersInvolved: [
          { playerId: kane.id, name: kane.fullName, from: "DET", to: "WPG" },
        ],
        draftPicks: [
          { from: "WPG", to: "DET", year: 2026, round: 3 },
        ],
        capImpact: {
          DET: { capRelief: 2750000 },
          WPG: { capAdded: 2750000 },
        },
        notes: "Winnipeg adds veteran experience for a playoff push. Low risk — Kane's deal expires end of season.",
      },
    });
  }

  // ── Saved Reports ──
  const comparisonPlayers = [mcdavid, matthews, mackinnon, draisaitl].filter(Boolean);
  if (comparisonPlayers.length >= 3) {
    await prisma.savedReport.create({
      data: {
        userId: demoUser.id,
        title: "Elite Centers Comparison",
        type: "COMPARISON",
        configuration: {
          playerIds: comparisonPlayers.map((p) => p!.id),
          metrics: ["overallScore", "pointsPerGame", "aav", "warPerDollar"],
          description: "Side-by-side comparison of the NHL's top centers by contract value",
        },
      },
    });
  }

  const valueTargets = [makar, raymond, celebrini, fantilli, michkov].filter(Boolean);
  if (valueTargets.length >= 3) {
    await prisma.savedReport.create({
      data: {
        userId: demoUser.id,
        title: "Best Value Under $10M AAV",
        type: "COMPARISON",
        configuration: {
          playerIds: valueTargets.map((p) => p!.id),
          metrics: ["overallScore", "aav", "age", "yearsRemaining"],
          description: "Young stars on team-friendly deals delivering elite production",
        },
      },
    });
  }

  console.log(`  Demo user: ${demoUser.email}`);
  console.log(`  Watch lists: 3`);
  console.log(`  Trade scenarios: ${[mcdavid && marner, huberdeau && kane, kane].filter(Boolean).length}`);
  console.log(`  Saved reports: ${[comparisonPlayers.length >= 3, valueTargets.length >= 3].filter(Boolean).length}`);

  // ── 10. Sample analytics events ──
  console.log("  Seeding sample analytics events...");

  const rand = seededRandom(42);
  const analyticsUsers = [demoUser.id];
  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (adminUser) analyticsUsers.push(adminUser.id);

  const samplePlayers = [mcdavid, matthews, makar, draisaitl, mackinnon, hellebuyck, shesterkin, marner, celebrini, raymond].filter(Boolean);
  const sampleTeamAbbrevs = ["TOR", "EDM", "COL", "NYR", "WPG", "FLA", "DAL", "CAR", "VGK", "BOS"];
  const sampleSearches = ["McDavid", "Matthews", "Makar", "Draisaitl", "centers under 7M", "defensemen", "goalies", "ELC", "Celebrini", "Raymond"];
  const sampleAIQueries = [
    "Best value centers under $7M",
    "Overpaid defensemen",
    "Top ELC steals",
    "Backup goalies under $2M",
    "Who has the best contract in the league?",
    "Compare McDavid and Matthews",
    "Trade targets for Colorado",
    "Expiring UFA forwards",
  ];
  const events: Array<{
    eventType: string;
    userId: string | null;
    metadata: Prisma.InputJsonValue | undefined;
    timestamp: Date;
  }> = [];

  // Generate 30 days of events
  const now = new Date();
  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const day = new Date(now);
    day.setDate(day.getDate() - dayOffset);
    const eventsPerDay = 5 + Math.floor(rand() * 20);

    for (let e = 0; e < eventsPerDay; e++) {
      const userId = analyticsUsers[Math.floor(rand() * analyticsUsers.length)];
      const hour = Math.floor(rand() * 14) + 8;
      const minute = Math.floor(rand() * 60);
      const ts = new Date(day);
      ts.setHours(hour, minute, 0, 0);

      // Weighted event type selection
      const r = rand();
      let eventType: string;
      let metadata: Record<string, unknown> | undefined = undefined;

      if (r < 0.30) {
        eventType = "PAGE_VIEW";
        metadata = { page: ["/dashboard", "/players", "/contracts", "/league-overview", "/compare", "/watchlist"][Math.floor(rand() * 6)] };
      } else if (r < 0.50) {
        eventType = "PLAYER_VIEW";
        const p = samplePlayers[Math.floor(rand() * samplePlayers.length)]!;
        metadata = { playerId: p.id, playerName: p.fullName, teamAbbrev: "NHL" };
      } else if (r < 0.60) {
        eventType = "TEAM_VIEW";
        const abbrev = sampleTeamAbbrevs[Math.floor(rand() * sampleTeamAbbrevs.length)];
        metadata = { teamAbbrev: abbrev, teamName: abbrev };
      } else if (r < 0.72) {
        eventType = "SEARCH";
        metadata = { query: sampleSearches[Math.floor(rand() * sampleSearches.length)] };
      } else if (r < 0.82) {
        eventType = "AI_SCOUT_QUERY";
        metadata = { query: sampleAIQueries[Math.floor(rand() * sampleAIQueries.length)] };
      } else if (r < 0.87) {
        eventType = "AI_BRIEFING_GENERATED";
        metadata = { teamId: "demo" };
      } else if (r < 0.90) {
        eventType = "TRADE_SAVED";
        metadata = { name: "Demo trade" };
      } else if (r < 0.93) {
        eventType = "WATCHLIST_ADDED";
        const p = samplePlayers[Math.floor(rand() * samplePlayers.length)]!;
        metadata = { playerId: p.id };
      } else if (r < 0.95) {
        eventType = "COMPARISON_CREATED";
      } else if (r < 0.97) {
        eventType = "REPORT_EXPORTED";
      } else if (r < 0.99) {
        eventType = "LOGIN";
      } else {
        eventType = "DEMO_LOGIN";
      }

      events.push({ eventType, userId, metadata: metadata as Prisma.InputJsonValue | undefined, timestamp: ts });
    }
  }

  // Batch insert
  await prisma.analyticsEvent.createMany({ data: events });
  console.log(`  Analytics events: ${events.length}`);

  // ── 11. Summary ──
  const teamCount = await prisma.team.count();
  const playerCount = await prisma.player.count();
  const contractCount = await prisma.contract.count();
  const seasonStatsCount = await prisma.seasonStats.count();
  const goalieStatsCount = await prisma.goalieStats.count();
  const advStatsCount = await prisma.advancedStats.count();
  const valueScoreCount = await prisma.playerValueScore.count();
  const impactStatsCount = await prisma.playerImpactStats.count();
  const analyticsCount = await prisma.analyticsEvent.count();

  console.log("\n✅ Seed complete!");
  console.log(`   Teams:          ${teamCount}`);
  console.log(`   Players:        ${playerCount}`);
  console.log(`   Contracts:      ${contractCount}`);
  console.log(`   Season Stats:   ${seasonStatsCount}`);
  console.log(`   Goalie Stats:   ${goalieStatsCount}`);
  console.log(`   Advanced Stats: ${advStatsCount}`);
  console.log(`   Impact Stats:   ${impactStatsCount}`);
  console.log(`   Value Scores:   ${valueScoreCount}`);
  console.log(`   Analytics:      ${analyticsCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
