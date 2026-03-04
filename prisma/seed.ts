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
  const adminPasswordHash = await bcrypt.hash("admin2025", 10);
  await prisma.user.create({
    data: {
      email: "admin@rostermatrix.app",
      name: "Admin",
      passwordHash: adminPasswordHash,
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

  // ── Seed team transactions, injuries, and draft picks for ALL 32 teams ──
  console.log("  Seeding transactions, injuries, and draft picks for all 32 teams...");

  const now = new Date();
  const txRng = seededRandom(7777);

  function recentDate(daysAgo: number): Date {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d;
  }

  // All 32 team abbreviations
  const allTeamAbbrevs = TEAMS.map((t) => t.abbrev);

  // ── Transaction templates per team ──
  // Each team gets 4 realistic transactions: 2 TRADE, 1 SIGNING, 1 WAIVER/RECALL
  const teamTransactions: Record<string, Array<{ type: "TRADE" | "SIGNING" | "WAIVER" | "RECALL"; desc: string; days: number }>> = {
    ANA: [
      { type: "TRADE", desc: "Acquired D Jacob Trouba from NYR for a 2026 2nd-round pick and 2027 conditional 5th", days: 6 },
      { type: "TRADE", desc: "Traded F Adam Henrique to VGK for a 2026 3rd-round pick", days: 42 },
      { type: "SIGNING", desc: "Signed F Leo Carlsson to a 3-year, $4.5M extension", days: 15 },
      { type: "WAIVER", desc: "Placed F Brett Leason on waivers", days: 30 },
    ],
    BOS: [
      { type: "TRADE", desc: "Acquired F Tyler Bertuzzi from CHI for a 2026 3rd-round pick", days: 21 },
      { type: "TRADE", desc: "Traded D Matt Grzelcyk to PIT for a 2026 5th-round pick", days: 45 },
      { type: "SIGNING", desc: "Signed D Charlie McAvoy to a 4-year, $38.4M extension", days: 13 },
      { type: "RECALL", desc: "Recalled F Fabian Lysell from AHL Providence", days: 8 },
    ],
    BUF: [
      { type: "TRADE", desc: "Acquired D Bowen Byram from COL for a 2026 2nd-round pick", days: 10 },
      { type: "TRADE", desc: "Traded F Jeff Skinner to EDM for a 2026 4th-round pick and prospect", days: 55 },
      { type: "SIGNING", desc: "Signed F Tage Thompson to a 7-year, $50M extension", days: 20 },
      { type: "WAIVER", desc: "Placed F Zemgus Girgensons on waivers", days: 35 },
    ],
    CGY: [
      { type: "TRADE", desc: "Traded F Jonathan Huberdeau to DET with a 2026 1st-round pick", days: 12 },
      { type: "TRADE", desc: "Acquired D prospect and 2027 2nd-round pick from SEA for F Andrew Mangiapane", days: 38 },
      { type: "SIGNING", desc: "Signed F Connor Zary to a 2-year, $3.1M bridge deal", days: 18 },
      { type: "RECALL", desc: "Recalled F Matthew Coronato from AHL Calgary Wranglers", days: 5 },
    ],
    CAR: [
      { type: "TRADE", desc: "Traded F Martin Necas to COL in a three-team deal", days: 8 },
      { type: "TRADE", desc: "Acquired F Mikko Rantanen from COL for F Martin Necas and draft capital", days: 8 },
      { type: "SIGNING", desc: "Signed F Sebastian Aho to an 8-year, $78M extension", days: 14 },
      { type: "RECALL", desc: "Recalled D Scott Morrow from AHL Chicago Wolves", days: 33 },
    ],
    CHI: [
      { type: "TRADE", desc: "Traded F Tyler Bertuzzi to BOS for a 2026 3rd-round pick", days: 21 },
      { type: "TRADE", desc: "Acquired a 2026 2nd-round pick from MIN for F Jason Dickinson", days: 50 },
      { type: "SIGNING", desc: "Signed F Connor Bedard to a 3-year, $10.5M extension", days: 10 },
      { type: "WAIVER", desc: "Placed F Colin Blackwell on waivers", days: 28 },
    ],
    COL: [
      { type: "TRADE", desc: "Acquired F Mikko Rantanen from CAR in a three-team deal", days: 8 },
      { type: "TRADE", desc: "Traded D Bowen Byram to BUF for a 2026 2nd-round pick", days: 10 },
      { type: "SIGNING", desc: "Signed G Alexandar Georgiev to a 1-year, $3.4M deal", days: 22 },
      { type: "WAIVER", desc: "Claimed F Miles Wood off waivers from NJD", days: 35 },
    ],
    CBJ: [
      { type: "TRADE", desc: "Traded F Patrik Laine to MTL for a 2026 1st-round pick and prospect", days: 15 },
      { type: "TRADE", desc: "Acquired a 2027 3rd-round pick from PHI for D Erik Gudbranson", days: 40 },
      { type: "SIGNING", desc: "Signed F Kirill Marchenko to a 3-year, $5.9M extension", days: 8 },
      { type: "RECALL", desc: "Recalled F James van Riemsdyk from AHL Cleveland", days: 20 },
    ],
    DAL: [
      { type: "TRADE", desc: "Traded D Chris Tanev to TOR for a 2026 2nd-round pick", days: 18 },
      { type: "TRADE", desc: "Acquired F Max Pacioretty from WSH for future considerations", days: 48 },
      { type: "SIGNING", desc: "Signed F Jason Robertson to a 4-year, $31.2M extension", days: 11 },
      { type: "RECALL", desc: "Recalled F Logan Stankoven from AHL Texas Stars", days: 42 },
    ],
    DET: [
      { type: "TRADE", desc: "Acquired F Vladimir Tarasenko in a deadline deal with OTT", days: 10 },
      { type: "TRADE", desc: "Traded G Ville Husso to ANA for a 2027 4th-round pick", days: 52 },
      { type: "SIGNING", desc: "Signed D Simon Edvinsson to a 3-year, $3.15M extension", days: 4 },
      { type: "WAIVER", desc: "Placed F Robby Fabbri on unconditional waivers", days: 45 },
    ],
    EDM: [
      { type: "TRADE", desc: "Acquired F Vasily Podkolzin from VAN for a 2026 4th-round pick", days: 12 },
      { type: "TRADE", desc: "Traded D Cody Ceci to SJS for a 2027 5th-round pick", days: 50 },
      { type: "SIGNING", desc: "Signed F Leon Draisaitl to an 8-year, $112M extension", days: 3 },
      { type: "RECALL", desc: "Recalled D Philip Broberg from AHL Bakersfield", days: 30 },
    ],
    FLA: [
      { type: "TRADE", desc: "Acquired D Oliver Ekman-Larsson from TOR for future considerations", days: 20 },
      { type: "TRADE", desc: "Traded a 2027 4th-round pick to CBJ for F Dmitri Voronkov", days: 35 },
      { type: "SIGNING", desc: "Signed G Sergei Bobrovsky to a 2-year extension", days: 7 },
      { type: "RECALL", desc: "Recalled F Mackie Samoskevich from AHL Charlotte", days: 14 },
    ],
    LAK: [
      { type: "TRADE", desc: "Acquired F Tanner Jeannot from TBL for a 2026 4th-round pick", days: 9 },
      { type: "TRADE", desc: "Traded D Sean Walker to PHI for a 2027 6th-round pick", days: 55 },
      { type: "SIGNING", desc: "Signed F Adrian Kempe to a 4-year, $22M extension", days: 16 },
      { type: "WAIVER", desc: "Placed F Carl Grundstrom on waivers", days: 28 },
    ],
    MIN: [
      { type: "TRADE", desc: "Acquired F Marcus Johansson from COL for a 2026 5th-round pick", days: 14 },
      { type: "TRADE", desc: "Traded D John Klingberg to PIT for future considerations", days: 48 },
      { type: "SIGNING", desc: "Signed F Kirill Kaprizov to an 8-year, $87M extension", days: 5 },
      { type: "RECALL", desc: "Recalled F Marco Rossi from AHL Iowa Wild", days: 22 },
    ],
    MTL: [
      { type: "TRADE", desc: "Acquired F Patrik Laine from CBJ for a 2026 1st-round pick and prospect", days: 15 },
      { type: "TRADE", desc: "Traded D David Savard to WPG for a 2027 4th-round pick", days: 44 },
      { type: "SIGNING", desc: "Signed F Nick Suzuki to a 7-year, $56M extension", days: 10 },
      { type: "WAIVER", desc: "Placed F Joel Armia on waivers", days: 32 },
    ],
    NSH: [
      { type: "TRADE", desc: "Traded F Ryan O'Reilly to TOR for a 2026 2nd-round pick and prospect", days: 11 },
      { type: "TRADE", desc: "Acquired a 2027 3rd-round pick from STL for D Jeremy Lauzon", days: 40 },
      { type: "SIGNING", desc: "Signed G Juuse Saros to a 6-year, $45M extension", days: 18 },
      { type: "RECALL", desc: "Recalled F Philip Tomasino from AHL Milwaukee", days: 7 },
    ],
    NJD: [
      { type: "TRADE", desc: "Acquired D Brenden Dillon from WPG for a 2026 4th-round pick", days: 12 },
      { type: "TRADE", desc: "Traded G Mackenzie Blackwood to COL in a multi-player deal", days: 45 },
      { type: "SIGNING", desc: "Signed F Jack Hughes to an 8-year, $64M extension", days: 8 },
      { type: "WAIVER", desc: "Placed F Miles Wood on waivers", days: 35 },
    ],
    NYI: [
      { type: "TRADE", desc: "Traded F Nikolaj Ehlers to WPG for a 2026 1st-round pick", days: 16 },
      { type: "TRADE", desc: "Acquired D Scott Perunovich from STL for a 2027 5th-round pick", days: 38 },
      { type: "SIGNING", desc: "Signed F Mathew Barzal to a 4-year, $30M extension", days: 6 },
      { type: "RECALL", desc: "Recalled F Aatu Raty from AHL Bridgeport", days: 20 },
    ],
    NYR: [
      { type: "TRADE", desc: "Traded D Jacob Trouba to ANA for draft picks", days: 6 },
      { type: "TRADE", desc: "Acquired F Reilly Smith from PIT for a 2026 3rd-round pick", days: 42 },
      { type: "SIGNING", desc: "Signed F Artemi Panarin to a 5-year extension", days: 15 },
      { type: "RECALL", desc: "Recalled F Brennan Othmann from AHL Hartford", days: 28 },
    ],
    OTT: [
      { type: "TRADE", desc: "Traded F Vladimir Tarasenko to DET for a 2027 3rd-round pick", days: 10 },
      { type: "TRADE", desc: "Acquired F Nick Paul from TBL for a 2026 5th-round pick", days: 50 },
      { type: "SIGNING", desc: "Signed D Thomas Chabot to a 6-year, $49.5M extension", days: 12 },
      { type: "RECALL", desc: "Recalled F Ridly Greig from AHL Belleville", days: 18 },
    ],
    PHI: [
      { type: "TRADE", desc: "Traded D Ivan Provorov to CBJ for a 2026 2nd-round pick and D Erik Gudbranson", days: 40 },
      { type: "TRADE", desc: "Acquired D Sean Walker from LAK for a 2027 6th-round pick", days: 55 },
      { type: "SIGNING", desc: "Signed F Travis Konecny to a 7-year, $57.5M extension", days: 9 },
      { type: "WAIVER", desc: "Placed F Nicolas Deslauriers on waivers", days: 25 },
    ],
    PIT: [
      { type: "TRADE", desc: "Acquired D Matt Grzelcyk from BOS for a 2026 5th-round pick", days: 45 },
      { type: "TRADE", desc: "Traded F Reilly Smith to NYR for a 2026 3rd-round pick", days: 42 },
      { type: "SIGNING", desc: "Signed F Sidney Crosby to a 2-year, $17.4M extension", days: 4 },
      { type: "RECALL", desc: "Recalled F Samuel Poulin from AHL Wilkes-Barre", days: 15 },
    ],
    SJS: [
      { type: "TRADE", desc: "Acquired D Cody Ceci from EDM for a 2027 5th-round pick", days: 50 },
      { type: "TRADE", desc: "Traded F Alexander Barabanov to FLA for a 2027 6th-round pick", days: 38 },
      { type: "SIGNING", desc: "Signed F Macklin Celebrini to a 3-year, $10.5M ELC extension", days: 8 },
      { type: "WAIVER", desc: "Placed F Luke Kunin on waivers", days: 22 },
    ],
    SEA: [
      { type: "TRADE", desc: "Traded F Andre Burakovsky to COL for a 2026 4th-round pick", days: 14 },
      { type: "TRADE", desc: "Acquired a 2027 2nd-round pick from CGY for F Andrew Mangiapane", days: 38 },
      { type: "SIGNING", desc: "Signed F Matty Beniers to a 3-year, $5.4M bridge deal", days: 10 },
      { type: "RECALL", desc: "Recalled F Shane Wright from AHL Coachella Valley", days: 5 },
    ],
    STL: [
      { type: "TRADE", desc: "Traded D Torey Krug to NYI for a 2027 3rd-round pick", days: 18 },
      { type: "TRADE", desc: "Acquired a 2026 4th-round pick from NJD for F Jakub Vrana", days: 50 },
      { type: "SIGNING", desc: "Signed F Robert Thomas to a 7-year, $56.5M extension", days: 7 },
      { type: "WAIVER", desc: "Placed F Kasperi Kapanen on waivers", days: 30 },
    ],
    TBL: [
      { type: "TRADE", desc: "Traded F Tanner Jeannot to LAK for a 2026 4th-round pick", days: 9 },
      { type: "TRADE", desc: "Acquired a 2027 3rd-round pick from OTT for F Nick Paul", days: 50 },
      { type: "SIGNING", desc: "Signed F Nikita Kucherov to a 4-year, $49M extension", days: 11 },
      { type: "RECALL", desc: "Recalled F Gage Goncalves from AHL Syracuse", days: 20 },
    ],
    TOR: [
      { type: "TRADE", desc: "Acquired D Chris Tanev from DAL for a 2026 2nd-round pick", days: 18 },
      { type: "TRADE", desc: "Traded F Ryan O'Reilly to NSH for a 2026 2nd-round pick and prospect", days: 48 },
      { type: "SIGNING", desc: "Signed F Bobby McMann to a 3-year, $6.75M extension", days: 5 },
      { type: "WAIVER", desc: "Placed D Timothy Liljegren on waivers", days: 40 },
    ],
    UTA: [
      { type: "TRADE", desc: "Acquired F Sean Monahan from WPG for a 2027 4th-round pick", days: 12 },
      { type: "TRADE", desc: "Traded D Michael Kesselring to STL for a 2026 5th-round pick", days: 42 },
      { type: "SIGNING", desc: "Signed F Clayton Keller to a 4-year, $29M extension", days: 9 },
      { type: "RECALL", desc: "Recalled F Josh Doan from AHL Tucson", days: 16 },
    ],
    VAN: [
      { type: "TRADE", desc: "Traded F Vasily Podkolzin to EDM for a 2026 4th-round pick", days: 12 },
      { type: "TRADE", desc: "Acquired D Filip Hronek from PIT in a multi-player deal", days: 45 },
      { type: "SIGNING", desc: "Signed F Elias Pettersson to an 8-year, $92.8M extension", days: 6 },
      { type: "WAIVER", desc: "Placed F Dakota Joshua on waivers", days: 30 },
    ],
    VGK: [
      { type: "TRADE", desc: "Acquired F Adam Henrique from ANA for a 2026 3rd-round pick", days: 42 },
      { type: "TRADE", desc: "Traded D Shea Theodore to DAL for a 2026 1st-round pick and F prospect", days: 16 },
      { type: "SIGNING", desc: "Signed F Jack Eichel to a 6-year, $63M extension", days: 8 },
      { type: "RECALL", desc: "Recalled F Brendan Brisson from AHL Henderson", days: 22 },
    ],
    WPG: [
      { type: "TRADE", desc: "Acquired F Nikolaj Ehlers from NYI for a 2026 1st-round pick", days: 16 },
      { type: "TRADE", desc: "Traded D Brenden Dillon to NJD for a 2026 4th-round pick", days: 12 },
      { type: "SIGNING", desc: "Signed G Connor Hellebuyck to a 6-year, $49.5M extension", days: 9 },
      { type: "RECALL", desc: "Recalled F Cole Perfetti from AHL Manitoba", days: 25 },
    ],
    WSH: [
      { type: "TRADE", desc: "Traded F Max Pacioretty to DAL for future considerations", days: 48 },
      { type: "TRADE", desc: "Acquired D Joel Edmundson from TOR for a 2027 5th-round pick", days: 35 },
      { type: "SIGNING", desc: "Signed F Tom Wilson to a 4-year, $26M extension", days: 7 },
      { type: "RECALL", desc: "Recalled F Connor McMichael from AHL Hershey", days: 14 },
    ],
  };

  // Create all transactions
  const txData: Array<{ teamId: string; type: "TRADE" | "SIGNING" | "WAIVER" | "RECALL"; description: string; playersInvolved: never[]; date: Date }> = [];
  for (const abbrev of allTeamAbbrevs) {
    const tid = teamMap.get(abbrev);
    if (!tid) continue;
    const entries = teamTransactions[abbrev] ?? [];
    for (const tx of entries) {
      txData.push({
        teamId: tid,
        type: tx.type,
        description: tx.desc,
        playersInvolved: [],
        date: recentDate(tx.days),
      });
    }
  }
  await prisma.transaction.createMany({ data: txData });

  // ── Injuries for ALL 32 teams ──
  // Fetch all players grouped by team for injury assignment
  const allPlayersForInjuries = await prisma.player.findMany({
    select: { id: true, fullName: true, position: true, currentTeamId: true },
    where: { currentTeamId: { not: null } },
  });
  const playersByTeamId = new Map<string, Array<{ id: string; fullName: string; position: string }>>();
  for (const p of allPlayersForInjuries) {
    if (!p.currentTeamId) continue;
    if (!playersByTeamId.has(p.currentTeamId)) playersByTeamId.set(p.currentTeamId, []);
    playersByTeamId.get(p.currentTeamId)!.push({ id: p.id, fullName: p.fullName, position: p.position });
  }

  const injuryDescriptions: Array<{ type: "DAY_TO_DAY" | "IR" | "LTIR"; desc: string; daysAgo: number; returnDays: number | null }> = [
    { type: "DAY_TO_DAY", desc: "Upper body", daysAgo: 3, returnDays: 7 },
    { type: "DAY_TO_DAY", desc: "Lower body", daysAgo: 5, returnDays: 10 },
    { type: "DAY_TO_DAY", desc: "Illness", daysAgo: 1, returnDays: 3 },
    { type: "IR", desc: "Lower body", daysAgo: 14, returnDays: 28 },
    { type: "IR", desc: "Upper body", daysAgo: 10, returnDays: 21 },
    { type: "IR", desc: "Hand fracture", daysAgo: 12, returnDays: 30 },
    { type: "IR", desc: "Ankle sprain", daysAgo: 18, returnDays: 35 },
    { type: "IR", desc: "Knee", daysAgo: 16, returnDays: 28 },
    { type: "IR", desc: "Concussion protocol", daysAgo: 8, returnDays: 21 },
    { type: "LTIR", desc: "Knee — ACL recovery", daysAgo: 90, returnDays: null },
    { type: "LTIR", desc: "Shoulder surgery", daysAgo: 75, returnDays: null },
    { type: "LTIR", desc: "Hip surgery recovery", daysAgo: 120, returnDays: null },
    { type: "LTIR", desc: "Wrist surgery", daysAgo: 60, returnDays: null },
  ];

  const injuryData: Array<{ playerId: string; teamId: string; type: "DAY_TO_DAY" | "IR" | "LTIR"; description: string; date: Date; expectedReturn: Date | null }> = [];
  for (const abbrev of allTeamAbbrevs) {
    const tid = teamMap.get(abbrev);
    if (!tid) continue;
    const teamPlayers = playersByTeamId.get(tid);
    if (!teamPlayers || teamPlayers.length === 0) continue;

    // Each team gets 2-4 injuries (deterministic via PRNG)
    const injCount = 2 + Math.floor(txRng() * 3); // 2, 3, or 4
    const usedPlayerIds = new Set<string>();

    for (let i = 0; i < injCount && i < teamPlayers.length; i++) {
      // Pick a player deterministically, avoiding duplicates
      let playerIdx = Math.floor(txRng() * teamPlayers.length);
      let attempts = 0;
      while (usedPlayerIds.has(teamPlayers[playerIdx].id) && attempts < teamPlayers.length) {
        playerIdx = (playerIdx + 1) % teamPlayers.length;
        attempts++;
      }
      if (usedPlayerIds.has(teamPlayers[playerIdx].id)) continue;
      usedPlayerIds.add(teamPlayers[playerIdx].id);

      const injTemplate = injuryDescriptions[Math.floor(txRng() * injuryDescriptions.length)];
      // Add some jitter to days so injuries are not all identical
      const daysJitter = Math.floor(txRng() * 5);
      const injDate = recentDate(injTemplate.daysAgo + daysJitter);
      const retDate = injTemplate.returnDays
        ? new Date(injDate.getTime() + injTemplate.returnDays * 24 * 60 * 60 * 1000)
        : null;

      injuryData.push({
        playerId: teamPlayers[playerIdx].id,
        teamId: tid,
        type: injTemplate.type,
        description: injTemplate.desc,
        date: injDate,
        expectedReturn: retDate,
      });
    }
  }
  await prisma.injury.createMany({ data: injuryData });

  // ── Draft picks for ALL 32 teams — 2025, 2026, 2027 ──
  console.log("  Seeding draft picks for all 32 teams (2025-2027)...");

  const draftYears = [2025, 2026, 2027];
  const rounds = [1, 2, 3, 4, 5, 6, 7];

  // Deterministic trade patterns: contenders trade picks to rebuilders
  // Format: { from: contender, to: rebuilder, year, round }
  const pickTrades: Array<{ from: string; to: string; year: number; round: number }> = [
    // 2025 draft trades (most already happened)
    { from: "EDM", to: "ANA", year: 2025, round: 1 },
    { from: "FLA", to: "CHI", year: 2025, round: 1 },
    { from: "TOR", to: "CBJ", year: 2025, round: 2 },
    { from: "COL", to: "SJS", year: 2025, round: 2 },
    { from: "DAL", to: "MTL", year: 2025, round: 3 },
    { from: "NYR", to: "BUF", year: 2025, round: 3 },
    { from: "VGK", to: "PHI", year: 2025, round: 4 },
    { from: "TBL", to: "UTA", year: 2025, round: 4 },
    { from: "WPG", to: "ANA", year: 2025, round: 5 },
    { from: "CAR", to: "CHI", year: 2025, round: 5 },
    { from: "BOS", to: "SJS", year: 2025, round: 6 },
    // 2026 draft trades
    { from: "EDM", to: "SJS", year: 2026, round: 1 },
    { from: "TOR", to: "ANA", year: 2026, round: 2 },
    { from: "FLA", to: "CBJ", year: 2026, round: 2 },
    { from: "COL", to: "MTL", year: 2026, round: 3 },
    { from: "DAL", to: "CHI", year: 2026, round: 3 },
    { from: "NYR", to: "BUF", year: 2026, round: 4 },
    { from: "VGK", to: "PHI", year: 2026, round: 4 },
    { from: "WPG", to: "UTA", year: 2026, round: 5 },
    { from: "CAR", to: "ANA", year: 2026, round: 6 },
    { from: "TBL", to: "SJS", year: 2026, round: 6 },
    { from: "BOS", to: "CBJ", year: 2026, round: 7 },
    // 2027 draft trades
    { from: "COL", to: "ANA", year: 2027, round: 1 },
    { from: "FLA", to: "CHI", year: 2027, round: 2 },
    { from: "TOR", to: "MTL", year: 2027, round: 2 },
    { from: "EDM", to: "SJS", year: 2027, round: 3 },
    { from: "DAL", to: "BUF", year: 2027, round: 3 },
    { from: "NYR", to: "PHI", year: 2027, round: 4 },
    { from: "VGK", to: "UTA", year: 2027, round: 4 },
    { from: "WPG", to: "CBJ", year: 2027, round: 5 },
    { from: "CAR", to: "ANA", year: 2027, round: 6 },
    { from: "TBL", to: "CHI", year: 2027, round: 7 },
  ];

  // Build a lookup: "originalTeam-year-round" -> acquiring team abbreviation
  const tradedPickLookup = new Map<string, string>();
  for (const t of pickTrades) {
    tradedPickLookup.set(`${t.from}-${t.year}-${t.round}`, t.to);
  }

  // Conditions for certain picks
  const conditionedPicks = new Set([
    "EDM-2026-1",   // lottery protected
    "COL-2027-1",   // top-10 protected
    "FLA-2025-1",   // lottery protected
    "TOR-2026-2",   // becomes 1st if team misses playoffs
    "DAL-2027-3",   // conditional on games played
    "NYR-2027-4",   // conditional on re-signing
    "VGK-2027-4",   // conditional
  ]);

  const conditionTexts: Record<string, string> = {
    "EDM-2026-1": "Lottery protected — if pick is top 3, defers to 2027",
    "COL-2027-1": "Top-10 protected — if pick is top 10, defers to 2028",
    "FLA-2025-1": "Lottery protected — if pick is top 3, becomes 2026 1st",
    "TOR-2026-2": "Upgrades to 2026 1st if Toronto misses playoffs",
    "DAL-2027-3": "Conditional on traded player playing 50+ games",
    "NYR-2027-4": "Conditional on player re-signing with acquiring team",
    "VGK-2027-4": "Conditional on Vegas reaching conference finals",
  };

  const draftPickData: Array<{ teamId: string; originalTeamId: string; year: number; round: number; condition: string | null }> = [];
  for (const abbrev of allTeamAbbrevs) {
    const origTeamId = teamMap.get(abbrev)!;
    for (const year of draftYears) {
      for (const round of rounds) {
        const tradeKey = `${abbrev}-${year}-${round}`;
        const acquiringAbbrev = tradedPickLookup.get(tradeKey);
        const ownerTeamId = acquiringAbbrev ? teamMap.get(acquiringAbbrev)! : origTeamId;
        const condKey = `${abbrev}-${year}-${round}`;
        const condition = conditionedPicks.has(condKey) ? (conditionTexts[condKey] ?? "Conditional") : null;

        draftPickData.push({
          teamId: ownerTeamId,
          originalTeamId: origTeamId,
          year,
          round,
          condition,
        });
      }
    }
  }
  await prisma.draftPick.createMany({ data: draftPickData });

  const txCount = await prisma.transaction.count();
  const injCount = await prisma.injury.count();
  const pickCount = await prisma.draftPick.count();
  console.log(`  Transactions: ${txCount} (${allTeamAbbrevs.length} teams)`);
  console.log(`  Injuries: ${injCount} (${allTeamAbbrevs.length} teams)`);
  console.log(`  Draft picks: ${pickCount} (${draftYears.length} years × ${allTeamAbbrevs.length} teams × ${rounds.length} rounds)`);

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
  const draftPickCount = await prisma.draftPick.count();
  const transactionCount = await prisma.transaction.count();
  const injuryCount = await prisma.injury.count();

  console.log("\n✅ Seed complete!");
  console.log(`   Teams:          ${teamCount}`);
  console.log(`   Players:        ${playerCount}`);
  console.log(`   Contracts:      ${contractCount}`);
  console.log(`   Season Stats:   ${seasonStatsCount}`);
  console.log(`   Goalie Stats:   ${goalieStatsCount}`);
  console.log(`   Advanced Stats: ${advStatsCount}`);
  console.log(`   Impact Stats:   ${impactStatsCount}`);
  console.log(`   Value Scores:   ${valueScoreCount}`);
  console.log(`   Transactions:   ${transactionCount}`);
  console.log(`   Injuries:       ${injuryCount}`);
  console.log(`   Draft Picks:    ${draftPickCount}`);
  console.log(`   Analytics:      ${analyticsCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
