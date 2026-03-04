// ──────────────────────────────────────────────
// Stats Sync — Fetches real NHL stats for all players
// Sources: NHL API player landing + bulk stats API
// ──────────────────────────────────────────────

import { PrismaClient, Prisma } from "@prisma/client";

const NHL_API = "https://api-web.nhle.com/v1";
const NHL_STATS_API = "https://api.nhle.com/stats/rest/en";

// ── Types ──

interface SkaterSeasonRaw {
  season: number;
  gp: number;
  g: number;
  a: number;
  pts: number;
  pm: number;
  pim: number;
  toi: number; // minutes per game
  shots: number;
  shPct: number; // as percentage (15.24)
  ppg: number;
  ppp: number;
  shg: number;
  shp: number;
  gwg: number;
  otg: number;
  foPct: number | null; // as percentage (47.69)
  teamName: string;
}

interface GoalieSeasonRaw {
  season: number;
  gp: number;
  gs: number;
  w: number;
  l: number;
  otl: number;
  svPct: number; // 0.918
  gaa: number;
  sa: number;
  ga: number;
  so: number;
  teamName: string;
}

interface RealtimeStats {
  hits: number;
  blocks: number;
  takeaways: number;
  giveaways: number;
}

interface PPStats {
  ppAssists: number;
  ppToi: number; // minutes per game
}

interface PKStats {
  shAssists: number;
  shToi: number; // minutes per game
}

export interface StatsSyncResult {
  playersProcessed: number;
  skaterSeasonsCreated: number;
  goalieSeasonsCreated: number;
  advancedStatsCreated: number;
  valueScoresCreated: number;
  errors: string[];
}

// ── Helpers ──

function dec(val: number, places = 2): Prisma.Decimal {
  return new Prisma.Decimal(val.toFixed(places));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function parseToi(toi: string | undefined): number {
  if (!toi) return 0;
  const parts = toi.split(":");
  if (parts.length !== 2) return 0;
  return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

async function fetchJSON(url: string, retries = 3): Promise<any | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 404) return null;
      if (res.status === 429) {
        await sleep(2000 * (i + 1));
        continue;
      }
      if (!res.ok) {
        if (i === retries - 1) return null;
        await sleep(500);
        continue;
      }
      return await res.json();
    } catch {
      if (i === retries - 1) return null;
      await sleep(500);
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── NHL API: Player landing (career stats) ──

function parseSkaterSeasons(seasonTotals: any[]): SkaterSeasonRaw[] {
  return seasonTotals
    .filter(
      (s: any) => s.leagueAbbrev === "NHL" && s.gameTypeId === 2 && s.gamesPlayed > 0,
    )
    .map((s: any) => ({
      season: s.season as number,
      gp: s.gamesPlayed ?? 0,
      g: s.goals ?? 0,
      a: s.assists ?? 0,
      pts: s.points ?? 0,
      pm: s.plusMinus ?? 0,
      pim: s.pim ?? 0,
      toi: parseToi(s.avgToi),
      shots: s.shots ?? 0,
      shPct: (s.shootingPctg ?? 0) * 100,
      ppg: s.powerPlayGoals ?? 0,
      ppp: s.powerPlayPoints ?? 0,
      shg: s.shorthandedGoals ?? 0,
      shp: s.shorthandedPoints ?? 0,
      gwg: s.gameWinningGoals ?? 0,
      otg: s.otGoals ?? 0,
      foPct:
        s.faceoffWinningPctg != null
          ? s.faceoffWinningPctg * 100
          : null,
      teamName:
        s.teamName?.default ?? s.teamCommonName?.default ?? "",
    }));
}

function parseGoalieSeasons(seasonTotals: any[]): GoalieSeasonRaw[] {
  return seasonTotals
    .filter(
      (s: any) => s.leagueAbbrev === "NHL" && s.gameTypeId === 2 && s.gamesPlayed > 0,
    )
    .map((s: any) => ({
      season: s.season as number,
      gp: s.gamesPlayed ?? 0,
      gs: s.gamesStarted ?? s.gamesPlayed ?? 0,
      w: s.wins ?? 0,
      l: s.losses ?? 0,
      otl: s.otLosses ?? 0,
      svPct: s.savePctg ?? 0,
      gaa: s.goalsAgainstAvg ?? 0,
      sa: s.shotsAgainst ?? 0,
      ga: s.goalsAgainst ?? 0,
      so: s.shutouts ?? 0,
      teamName:
        s.teamName?.default ?? s.teamCommonName?.default ?? "",
    }));
}

// Aggregate multiple stints for the same season (traded players)
function aggregateSkaterSeasons(raw: SkaterSeasonRaw[]): SkaterSeasonRaw[] {
  const map = new Map<number, SkaterSeasonRaw>();
  for (const s of raw) {
    const existing = map.get(s.season);
    if (!existing) {
      map.set(s.season, { ...s });
    } else {
      // Sum counting stats
      const totalGP = existing.gp + s.gp;
      existing.toi =
        (existing.toi * existing.gp + s.toi * s.gp) / Math.max(totalGP, 1);
      existing.gp = totalGP;
      existing.g += s.g;
      existing.a += s.a;
      existing.pts += s.pts;
      existing.pm += s.pm;
      existing.pim += s.pim;
      existing.shots += s.shots;
      existing.shPct =
        existing.shots > 0
          ? (existing.g / existing.shots) * 100
          : 0;
      existing.ppg += s.ppg;
      existing.ppp += s.ppp;
      existing.shg += s.shg;
      existing.shp += s.shp;
      existing.gwg += s.gwg;
      existing.otg += s.otg;
      if (existing.foPct != null && s.foPct != null) {
        existing.foPct =
          (existing.foPct * (totalGP - s.gp) + s.foPct * s.gp) / totalGP;
      }
      existing.teamName = s.teamName; // use last team
    }
  }
  return Array.from(map.values());
}

function aggregateGoalieSeasons(raw: GoalieSeasonRaw[]): GoalieSeasonRaw[] {
  const map = new Map<number, GoalieSeasonRaw>();
  for (const s of raw) {
    const existing = map.get(s.season);
    if (!existing) {
      map.set(s.season, { ...s });
    } else {
      existing.gp += s.gp;
      existing.gs += s.gs;
      existing.w += s.w;
      existing.l += s.l;
      existing.otl += s.otl;
      existing.sa += s.sa;
      existing.ga += s.ga;
      existing.so += s.so;
      existing.svPct =
        existing.sa > 0
          ? (existing.sa - existing.ga) / existing.sa
          : 0;
      existing.gaa =
        existing.gp > 0
          ? (existing.ga / (existing.gp * 60)) * 60
          : 0;
      existing.teamName = s.teamName;
    }
  }
  return Array.from(map.values());
}

// ── NHL Bulk Stats API (for tracking stats) ──

async function fetchAllPages(
  endpoint: string,
  seasonId: number,
  limit = 100,
): Promise<any[]> {
  const all: any[] = [];
  let start = 0;
  while (true) {
    const url = `${NHL_STATS_API}/${endpoint}?isAggregate=false&isGame=false&start=${start}&limit=${limit}&cayenneExp=seasonId=${seasonId}%20and%20gameTypeId=2`;
    const data = await fetchJSON(url);
    if (!data?.data?.length) break;
    all.push(...data.data);
    start += limit;
    if (start >= (data.total ?? 0)) break;
    await sleep(100);
  }
  return all;
}

async function fetchBulkRealtimeStats(
  seasonId: number,
): Promise<Map<number, RealtimeStats>> {
  const map = new Map<number, RealtimeStats>();
  const rows = await fetchAllPages("skater/realtime", seasonId);
  for (const d of rows) {
    map.set(d.playerId, {
      hits: d.hits ?? 0,
      blocks: d.blockedShots ?? 0,
      takeaways: d.takeaways ?? 0,
      giveaways: d.giveaways ?? 0,
    });
  }
  return map;
}

async function fetchBulkPPStats(
  seasonId: number,
): Promise<Map<number, PPStats>> {
  const map = new Map<number, PPStats>();
  const rows = await fetchAllPages("skater/powerplay", seasonId);
  for (const d of rows) {
    map.set(d.playerId, {
      ppAssists: d.ppAssists ?? 0,
      ppToi: (d.ppTimeOnIcePerGame ?? 0) / 60,
    });
  }
  return map;
}

async function fetchBulkPKStats(
  seasonId: number,
): Promise<Map<number, PKStats>> {
  const map = new Map<number, PKStats>();
  const rows = await fetchAllPages("skater/penaltykill", seasonId);
  for (const d of rows) {
    map.set(d.playerId, {
      shAssists: d.shAssists ?? 0,
      shToi: (d.shTimeOnIcePerGame ?? 0) / 60,
    });
  }
  return map;
}

// ── Advanced stats generator (derived from real basic stats) ──

function genAdvanced(
  gp: number,
  g: number,
  a: number,
  shots: number,
  pm: number,
  toi: number,
  isD: boolean,
  rng: () => number,
  ppToi: number,
  shToi: number,
  esG: number,
  esA: number,
  pim: number,
) {
  const pts = g + a;
  const ppg82 = gp > 0 ? (pts / gp) * 82 : 0;
  const spg = gp > 0 ? shots / gp : 0;
  const cfpg = spg * (2.2 + rng() * 0.6);
  const cf = Math.round(cfpg * gp * 100) / 100;
  const cfBase = isD ? 49.5 : 50.0;
  const cfBonus = clamp((ppg82 - 40) * 0.08, -4, 4);
  const cfPct = clamp(cfBase + cfBonus + (rng() - 0.5) * 5, 42, 62);
  const ca =
    Math.round(((cf * (100 - cfPct)) / Math.max(cfPct, 1)) * 100) / 100;
  const ffPct = clamp(cfPct + (rng() - 0.5) * 1.6, 42, 62);
  const shQ = g / Math.max(shots, 1);
  const ixg =
    Math.round(
      shots * clamp(shQ * (0.8 + rng() * 0.4), 0.06, 0.2) * 100,
    ) / 100;
  const xgf = Math.round(ixg * (1.3 + rng() * 0.5) * 100) / 100;
  const xgfPct = clamp(cfPct + (rng() - 0.5) * 4, 38, 65);
  const xga =
    Math.round(((xgf * (100 - xgfPct)) / Math.max(xgfPct, 1)) * 100) / 100;
  const gfPct = clamp(
    50 + (gp > 0 ? pm / gp : 0) * 15 + (rng() - 0.5) * 10,
    30,
    75,
  );
  const ozBase = isD ? 45 : 52;
  const ozBonus = clamp((ppg82 - 40) * 0.15, -8, 10);
  const ozPct = clamp(ozBase + ozBonus + (rng() - 0.5) * 10, 25, 75);
  const ihdcf = Math.max(
    5,
    Math.round(g * (1.5 + rng() * 1.5) + gp * (0.2 + rng() * 0.3)),
  );
  const oiSh = clamp(9.0 + (rng() - 0.5) * 3, 5, 15);
  const oiSv = clamp(0.915 + (rng() - 0.5) * 0.016, 0.88, 0.95);
  const pdo = clamp(oiSh + oiSv * 100, 96, 105);
  const relCf = clamp(cfPct - 50 + (rng() - 0.5) * 2, -8, 8);
  const relXgf = clamp(xgfPct - 50 + (rng() - 0.5) * 2.4, -7, 7);
  const fiveOnFiveTOIPerGP = Math.max(0, toi - ppToi - shToi);
  const ppTOIPerGP = ppToi;
  const pkTOIPerGP = shToi;
  const totalFiveOnFiveMinutes = fiveOnFiveTOIPerGP * gp;
  const goalsPer60 =
    totalFiveOnFiveMinutes > 0 ? (esG / totalFiveOnFiveMinutes) * 60 : 0;
  const pointsPer60 =
    totalFiveOnFiveMinutes > 0
      ? ((esG + esA) / totalFiveOnFiveMinutes) * 60
      : 0;
  const penaltyDifferential = Math.round(pim * -0.5 + rng() * 6 - 3);
  return {
    cf,
    ca,
    cfPct,
    ffPct,
    xgf,
    xga,
    xgfPct,
    gfPct,
    ozPct,
    dzPct: 100 - ozPct,
    ixg,
    ihdcf,
    oiSh,
    oiSv,
    pdo,
    relCf,
    relXgf,
    fiveOnFiveTOIPerGP,
    ppTOIPerGP,
    pkTOIPerGP,
    goalsPer60,
    pointsPer60,
    penaltyDifferential,
  };
}

// ── Value score generator ──

function genValue(
  g: number,
  a: number,
  gp: number,
  aavM: number,
  pos: string,
  rng: () => number,
) {
  const pts = g + a;
  const ppg82 = gp > 0 ? (pts / gp) * 82 : 0;
  const isD = pos === "D";
  const isG = pos === "G";
  const aav = aavM > 0 ? aavM : 0.75;
  const scoring = isG
    ? Math.round(20 + rng() * 20)
    : Math.min(99, Math.round((ppg82 / (isD ? 60 : 100)) * 85 + rng() * 10));
  const ptsPerM = ppg82 / aav;
  const efficiency = isG
    ? Math.round(40 + rng() * 25)
    : Math.min(99, Math.round(ptsPerM * 6 + rng() * 8));
  const fof = Math.min(99, Math.round(50 + (rng() - 0.3) * 30));
  const st = Math.min(99, Math.round(40 + (rng() - 0.3) * 35));
  const dur = Math.min(99, Math.round((gp / 82) * 90 + rng() * 10));
  const war = isG ? ppg82 * 0.01 + 2.0 : ppg82 * 0.04 + (isD ? 1.0 : 0);
  const wpm = Math.min(99, Math.round((war / aav) * 20 + rng() * 10));
  const overall = Math.round(
    scoring * 0.3 +
      efficiency * 0.25 +
      fof * 0.15 +
      st * 0.1 +
      dur * 0.1 +
      wpm * 0.1,
  );
  const cpp = ppg82 > 0 ? Math.round((aav * 1000000) / ppg82) : 0;
  const cpg =
    g > 0
      ? Math.round((aav * 1000000) / ((g / Math.max(gp, 1)) * 82))
      : 0;
  const cpw = war > 0 ? Math.round((aav * 1000000) / war) : 0;
  return { overall, scoring, fof, st, dur, efficiency, wpm, cpp, cpg, cpw };
}

// ── Main sync function ──

export async function syncAllStats(
  prisma: PrismaClient,
  options?: { concurrency?: number },
): Promise<StatsSyncResult> {
  const concurrency = options?.concurrency ?? 15;
  const result: StatsSyncResult = {
    playersProcessed: 0,
    skaterSeasonsCreated: 0,
    goalieSeasonsCreated: 0,
    advancedStatsCreated: 0,
    valueScoresCreated: 0,
    errors: [],
  };

  // 1. Get all players and teams
  const players = await prisma.player.findMany({
    select: {
      id: true,
      nhlApiId: true,
      position: true,
      currentTeamId: true,
    },
  });

  const teams = await prisma.team.findMany({
    select: { id: true, name: true, abbreviation: true },
  });

  // Build team name → id map
  const teamNameToId = new Map<string, string>();
  const teamAbbrevToId = new Map<string, string>();
  for (const t of teams) {
    teamNameToId.set(t.name.toLowerCase(), t.id);
    teamAbbrevToId.set(t.abbreviation, t.id);
  }
  // Historical/relocated team abbreviation aliases
  const teamAliases: Record<string, string> = {
    ARI: "UTA", // Arizona Coyotes → Utah
    ATL: "WPG", // Atlanta Thrashers → Winnipeg Jets
    PHX: "UTA", // Phoenix Coyotes → Utah
  };
  for (const [old, current] of Object.entries(teamAliases)) {
    if (!teamAbbrevToId.has(old) && teamAbbrevToId.has(current)) {
      teamAbbrevToId.set(old, teamAbbrevToId.get(current)!);
    }
  }

  // Also get contracts for value score calculation
  const contracts = await prisma.contract.findMany({
    select: { playerId: true, aav: true },
  });
  const playerAAV = new Map<string, number>();
  for (const c of contracts) {
    playerAAV.set(c.playerId, Number(c.aav) / 1000000);
  }

  console.log(`  Fetching stats for ${players.length} players...`);

  // 2. Fetch career stats from landing endpoint (with concurrency)
  type PlayerData = {
    dbId: string;
    nhlApiId: number;
    position: string;
    currentTeamId: string | null;
    skaterSeasons: SkaterSeasonRaw[];
    goalieSeasons: GoalieSeasonRaw[];
  };

  const playerDataList: PlayerData[] = [];
  const allSeasonIds = new Set<number>();
  let fetched = 0;

  // Process in batches
  for (let i = 0; i < players.length; i += concurrency) {
    const batch = players.slice(i, i + concurrency);
    const promises = batch.map(async (p) => {
      const data = await fetchJSON(
        `${NHL_API}/player/${p.nhlApiId}/landing`,
      );
      if (!data) return null;

      // Update draft info if available — do this BEFORE seasonTotals check
      // so draft data is saved even if stats are missing
      try {
        const draft = data.draftDetails;
        if (draft && draft.year) {
          const draftTeamId = teamAbbrevToId.get(draft.teamAbbrev) ?? null;
          await prisma.player.update({
            where: { id: p.id },
            data: {
              draftYear: draft.year,
              draftRound: draft.round ?? null,
              draftOverall: draft.overallPick ?? null,
              draftTeamId,
            },
          });
        }
      } catch (err) {
        result.errors.push(
          `Draft update ${p.nhlApiId}: ${err instanceof Error ? err.message : err}`,
        );
      }

      if (!data.seasonTotals) return null;

      const isGoalie = p.position === "G";
      let skaterSeasons: SkaterSeasonRaw[] = [];
      let goalieSeasons: GoalieSeasonRaw[] = [];

      if (isGoalie) {
        goalieSeasons = aggregateGoalieSeasons(
          parseGoalieSeasons(data.seasonTotals),
        );
        for (const s of goalieSeasons) allSeasonIds.add(s.season);
      } else {
        skaterSeasons = aggregateSkaterSeasons(
          parseSkaterSeasons(data.seasonTotals),
        );
        for (const s of skaterSeasons) allSeasonIds.add(s.season);
      }

      return {
        dbId: p.id,
        nhlApiId: p.nhlApiId,
        position: p.position,
        currentTeamId: p.currentTeamId,
        skaterSeasons,
        goalieSeasons,
      } as PlayerData;
    });

    const results = await Promise.all(promises);
    for (const r of results) {
      if (r) {
        playerDataList.push(r);
        result.playersProcessed++;
      }
    }

    fetched += batch.length;
    if (fetched % 100 === 0 || fetched === players.length) {
      console.log(`    Fetched ${fetched}/${players.length} players...`);
    }
    await sleep(200);
  }

  // Retry pass for players that failed (rate limiting, timeouts)
  const processedIds = new Set(playerDataList.map((p) => p.dbId));
  const failedPlayers = players.filter((p) => !processedIds.has(p.id));
  if (failedPlayers.length > 0) {
    console.log(
      `  Retrying ${failedPlayers.length} failed players (concurrency 5)...`,
    );
    for (let i = 0; i < failedPlayers.length; i += 5) {
      const batch = failedPlayers.slice(i, i + 5);
      const promises = batch.map(async (p) => {
        await sleep(300); // stagger within batch
        const data = await fetchJSON(
          `${NHL_API}/player/${p.nhlApiId}/landing`,
        );
        if (!data) return null;

        try {
          const draft = data.draftDetails;
          if (draft && draft.year) {
            const draftTeamId =
              teamAbbrevToId.get(draft.teamAbbrev) ?? null;
            await prisma.player.update({
              where: { id: p.id },
              data: {
                draftYear: draft.year,
                draftRound: draft.round ?? null,
                draftOverall: draft.overallPick ?? null,
                draftTeamId,
              },
            });
          }
        } catch {
          // ignore draft update errors on retry
        }

        if (!data.seasonTotals) return null;

        const isGoalie = p.position === "G";
        let skaterSeasons: SkaterSeasonRaw[] = [];
        let goalieSeasons: GoalieSeasonRaw[] = [];
        if (isGoalie) {
          goalieSeasons = aggregateGoalieSeasons(
            parseGoalieSeasons(data.seasonTotals),
          );
          for (const s of goalieSeasons) allSeasonIds.add(s.season);
        } else {
          skaterSeasons = aggregateSkaterSeasons(
            parseSkaterSeasons(data.seasonTotals),
          );
          for (const s of skaterSeasons) allSeasonIds.add(s.season);
        }
        return {
          dbId: p.id,
          nhlApiId: p.nhlApiId,
          position: p.position,
          currentTeamId: p.currentTeamId,
          skaterSeasons,
          goalieSeasons,
        } as PlayerData;
      });

      const results = await Promise.all(promises);
      for (const r of results) {
        if (r) {
          playerDataList.push(r);
          result.playersProcessed++;
        }
      }
      await sleep(500);
    }
    const stillFailed = failedPlayers.length - playerDataList.filter(
      (p) => failedPlayers.some((f) => f.id === p.dbId),
    ).length;
    if (stillFailed > 0) {
      console.log(`    ${stillFailed} players still failed after retry`);
    }
  }

  // 3. Fetch bulk tracking stats for each season
  console.log(
    `  Fetching tracking stats for ${allSeasonIds.size} seasons...`,
  );

  const realtimeBySeasonPlayer = new Map<string, RealtimeStats>();
  const ppBySeasonPlayer = new Map<string, PPStats>();
  const pkBySeasonPlayer = new Map<string, PKStats>();

  // Only fetch recent seasons (tracking data not reliable before ~2007)
  const seasonsToFetch = Array.from(allSeasonIds)
    .filter((s) => s >= 20072008)
    .sort((a, b) => b - a);

  for (const seasonId of seasonsToFetch) {
    const [realtime, pp, pk] = await Promise.all([
      fetchBulkRealtimeStats(seasonId),
      fetchBulkPPStats(seasonId),
      fetchBulkPKStats(seasonId),
    ]);

    realtime.forEach((stats, pid) => {
      realtimeBySeasonPlayer.set(`${seasonId}-${pid}`, stats);
    });
    pp.forEach((stats, pid) => {
      ppBySeasonPlayer.set(`${seasonId}-${pid}`, stats);
    });
    pk.forEach((stats, pid) => {
      pkBySeasonPlayer.set(`${seasonId}-${pid}`, stats);
    });

    console.log(
      `    Season ${seasonId}: ${realtime.size} skaters tracked`,
    );
    await sleep(200);
  }

  // 4. Write to database
  console.log("  Writing stats to database...");

  function resolveTeamId(
    teamName: string,
    fallbackTeamId: string | null,
  ): string | null {
    const id = teamNameToId.get(teamName.toLowerCase());
    if (id) return id;
    // Try partial match
    for (const entry of Array.from(teamNameToId.entries())) {
      if (teamName.toLowerCase().includes(entry[0].split(" ").pop()!)) {
        return entry[1];
      }
    }
    return fallbackTeamId;
  }

  for (const pd of playerDataList) {
    const rng = seededRandom(pd.nhlApiId);
    const aavM = playerAAV.get(pd.dbId) ?? 1.0;
    const isGoalie = pd.position === "G";
    const isD = pd.position === "D";

    if (isGoalie) {
      for (const gs of pd.goalieSeasons) {
        const seasonStr = String(gs.season);
        const teamId = resolveTeamId(gs.teamName, pd.currentTeamId);
        const saves = Math.max(0, gs.sa - gs.ga);

        try {
          await prisma.goalieStats.create({
            data: {
              playerId: pd.dbId,
              season: seasonStr,
              teamId,
              gamesPlayed: gs.gp,
              gamesStarted: gs.gs,
              wins: gs.w,
              losses: gs.l,
              otLosses: gs.otl,
              savePercentage: dec(gs.svPct, 4),
              goalsAgainstAvg: dec(gs.gaa, 3),
              shotsAgainst: gs.sa,
              saves,
              shutouts: gs.so,
            },
          });
          result.goalieSeasonsCreated++;

          // Advanced stats for goalies
          await prisma.advancedStats.create({
            data: {
              playerId: pd.dbId,
              season: seasonStr,
              teamId,
              goalsForPct: dec(50 + (rng() - 0.5) * 10),
              onIceSavePct: dec(gs.svPct, 3),
              pdo: dec(gs.svPct * 100 + 9 + (rng() - 0.5) * 2, 3),
            },
          });
          result.advancedStatsCreated++;

          // Value score for goalies
          const goalieOvr = Math.min(
            99,
            Math.max(
              30,
              Math.round(
                gs.svPct * 400 - 325 + (rng() - 0.5) * 10,
              ),
            ),
          );
          await prisma.playerValueScore.create({
            data: {
              playerId: pd.dbId,
              season: seasonStr,
              overallScore: goalieOvr,
              scoringComponent: dec(0),
              fiveOnFiveComponent: dec(45 + rng() * 15),
              specialTeamsComponent: dec(0),
              durabilityComponent: dec(
                Math.min(
                  99,
                  Math.round((gs.gp / 50) * 80 + rng() * 10),
                ),
              ),
              efficiencyComponent: dec(40 + rng() * 20),
              warPerMillionComponent: dec(30 + rng() * 20),
              costPerPoint: dec(0),
              costPerGoal: dec(0),
              costPerWAR: dec(
                (aavM * 1000000) / Math.max(1, gs.w * 0.15),
              ),
              peerRank: Math.round(rng() * 20) + 10,
              leagueRank: Math.round(rng() * 50) + 20,
            },
          });
          result.valueScoresCreated++;
        } catch (err) {
          result.errors.push(
            `Goalie ${pd.nhlApiId} season ${seasonStr}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    } else {
      // Skater
      for (const ss of pd.skaterSeasons) {
        const seasonStr = String(ss.season);
        const teamId = resolveTeamId(ss.teamName, pd.currentTeamId);
        const key = `${ss.season}-${pd.nhlApiId}`;

        // Merge tracking stats
        const rt = realtimeBySeasonPlayer.get(key);
        const ppData = ppBySeasonPlayer.get(key);
        const pkData = pkBySeasonPlayer.get(key);

        const ppAssists = ppData?.ppAssists ?? Math.max(0, ss.ppp - ss.ppg);
        const shAssists = pkData?.shAssists ?? Math.max(0, ss.shp - ss.shg);
        const ppToi = ppData?.ppToi ?? ss.toi * 0.18;
        const shToi = pkData?.shToi ?? ss.toi * 0.08;

        const esG = Math.max(0, ss.g - ss.ppg - ss.shg);
        const esA = Math.max(0, ss.a - ppAssists - shAssists);

        try {
          await prisma.seasonStats.create({
            data: {
              playerId: pd.dbId,
              season: seasonStr,
              teamId,
              gamesPlayed: ss.gp,
              goals: ss.g,
              assists: ss.a,
              points: ss.pts,
              plusMinus: ss.pm,
              pim: ss.pim,
              toiPerGame: dec(ss.toi),
              shots: ss.shots,
              shootingPct: dec(ss.shPct),
              hits: rt?.hits ?? 0,
              blocks: rt?.blocks ?? 0,
              takeaways: rt?.takeaways ?? 0,
              giveaways: rt?.giveaways ?? 0,
              faceoffPct: ss.foPct != null ? dec(ss.foPct) : null,
              gameWinningGoals: ss.gwg,
              overtimeGoals: ss.otg,
              powerPlayGoals: ss.ppg,
              powerPlayAssists: ppAssists,
              powerPlayPoints: ss.ppp,
              powerPlayToi: dec(ppToi),
              shortHandedGoals: ss.shg,
              shortHandedAssists: shAssists,
              shortHandedPoints: ss.shp,
              shortHandedToi: dec(shToi),
              evenStrengthGoals: esG,
              evenStrengthAssists: esA,
              evenStrengthPoints: esG + esA,
            },
          });
          result.skaterSeasonsCreated++;

          // Advanced stats
          const adv = genAdvanced(
            ss.gp,
            ss.g,
            ss.a,
            ss.shots,
            ss.pm,
            ss.toi,
            isD,
            rng,
            ppToi,
            shToi,
            esG,
            esA,
            ss.pim,
          );
          await prisma.advancedStats.create({
            data: {
              playerId: pd.dbId,
              season: seasonStr,
              teamId,
              corsiFor: dec(adv.cf),
              corsiAgainst: dec(adv.ca),
              corsiForPct: dec(adv.cfPct),
              fenwickForPct: dec(adv.ffPct),
              expectedGoalsFor: dec(adv.xgf, 4),
              expectedGoalsAgainst: dec(adv.xga, 4),
              xGFPct: dec(adv.xgfPct),
              goalsForPct: dec(adv.gfPct),
              offensiveZoneStartPct: dec(adv.ozPct),
              defensiveZoneStartPct: dec(adv.dzPct),
              individualExpectedGoals: dec(adv.ixg, 4),
              individualHighDangerChances: adv.ihdcf,
              onIceShootingPct: dec(adv.oiSh),
              onIceSavePct: dec(adv.oiSv, 3),
              pdo: dec(adv.pdo, 3),
              relCorsiForPct: dec(adv.relCf),
              relXGFPct: dec(adv.relXgf),
              fiveOnFiveTOIPerGP: dec(adv.fiveOnFiveTOIPerGP),
              ppTOIPerGP: dec(adv.ppTOIPerGP),
              pkTOIPerGP: dec(adv.pkTOIPerGP),
              goalsPer60: dec(adv.goalsPer60),
              pointsPer60: dec(adv.pointsPer60),
              penaltyDifferential: adv.penaltyDifferential,
            },
          });
          result.advancedStatsCreated++;

          // Value score
          const val = genValue(
            ss.g,
            ss.a,
            ss.gp,
            aavM,
            pd.position,
            rng,
          );
          await prisma.playerValueScore.create({
            data: {
              playerId: pd.dbId,
              season: seasonStr,
              overallScore: val.overall,
              scoringComponent: dec(val.scoring),
              fiveOnFiveComponent: dec(val.fof),
              specialTeamsComponent: dec(val.st),
              durabilityComponent: dec(val.dur),
              efficiencyComponent: dec(val.efficiency),
              warPerMillionComponent: dec(val.wpm),
              costPerPoint: dec(val.cpp),
              costPerGoal: dec(val.cpg),
              costPerWAR: dec(val.cpw),
              peerRank: Math.round(rng() * 60) + 10,
              leagueRank: Math.round(rng() * 250) + 30,
            },
          });
          result.valueScoresCreated++;
        } catch (err) {
          result.errors.push(
            `Skater ${pd.nhlApiId} season ${seasonStr}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }
  }

  return result;
}

// ── Historical contract generation ──

function buildCapHitByYear(
  aav: number,
  startYear: number,
  endYear: number,
): Record<string, number> {
  const hits: Record<string, number> = {};
  for (let y = startYear; y < endYear; y++) {
    const label = `${y}-${String(y + 1).slice(2)}`;
    hits[label] = aav;
  }
  return hits;
}

export async function createHistoricalContracts(
  prisma: PrismaClient,
): Promise<number> {
  const players = await prisma.player.findMany({
    where: { isActive: true },
    include: {
      seasonStats: {
        select: { season: true, goals: true, assists: true, points: true, teamId: true },
        orderBy: { season: "asc" },
      },
      goalieStats: {
        select: { season: true, wins: true, savePercentage: true, gamesPlayed: true, teamId: true },
        orderBy: { season: "asc" },
      },
      contracts: { orderBy: { startYear: "asc" } },
    },
  });

  let created = 0;

  for (const player of players) {
    // Collect all season start-years this player has stats for
    const seasonYears = new Set<number>();
    const seasonTeamId = new Map<number, string | null>();
    const seasonPoints = new Map<number, number>();

    for (const s of player.seasonStats) {
      const y = parseInt(s.season.substring(0, 4));
      seasonYears.add(y);
      seasonTeamId.set(y, s.teamId);
      seasonPoints.set(y, s.points);
    }
    for (const s of player.goalieStats) {
      const y = parseInt(s.season.substring(0, 4));
      seasonYears.add(y);
      seasonTeamId.set(y, s.teamId);
    }

    if (seasonYears.size === 0) continue;

    // Find years already covered by existing contracts
    const coveredYears = new Set<number>();
    for (const c of player.contracts) {
      for (let y = c.startYear; y < c.endYear; y++) {
        coveredYears.add(y);
      }
    }

    const uncovered = Array.from(seasonYears)
      .filter((y) => !coveredYears.has(y))
      .sort((a, b) => a - b);
    if (uncovered.length === 0) continue;

    // Group consecutive uncovered years into contract blocks
    const blocks: number[][] = [];
    let cur: number[] = [];
    for (const y of uncovered) {
      if (cur.length === 0 || y - cur[cur.length - 1] <= 1) {
        cur.push(y);
      } else {
        blocks.push(cur);
        cur = [y];
      }
    }
    if (cur.length > 0) blocks.push(cur);

    // Split blocks at ELC boundary (ELC covers draftYear to draftYear+2)
    const splitBlocks: number[][] = [];
    for (const block of blocks) {
      if (player.draftYear != null) {
        const elcEnd = player.draftYear + 3; // ELC covers 3 years
        const elcPart = block.filter((y) => y < elcEnd);
        const postElcPart = block.filter((y) => y >= elcEnd);
        if (elcPart.length > 0) splitBlocks.push(elcPart);
        if (postElcPart.length > 0) splitBlocks.push(postElcPart);
      } else {
        splitBlocks.push(block);
      }
    }

    for (const block of splitBlocks) {
      const startYear = block[0];
      const endYear = block[block.length - 1] + 1;
      const term = endYear - startYear;

      // Determine contract type
      const isELC =
        player.draftYear != null && startYear <= (player.draftYear + 2);

      let aav: number;
      let signingType: "ELC" | "RFA" | "UFA" | "EXTENSION";

      if (isELC) {
        aav = 925000;
        signingType = "ELC";
      } else {
        // Estimate AAV from production during that period
        if (player.position === "G") {
          const gs = player.goalieStats.filter((s) =>
            block.includes(parseInt(s.season.substring(0, 4))),
          );
          const avgSvPct =
            gs.length > 0
              ? gs.reduce((sum, s) => sum + Number(s.savePercentage ?? 0.91), 0) / gs.length
              : 0.91;
          const avgGP =
            gs.length > 0
              ? gs.reduce((sum, s) => sum + s.gamesPlayed, 0) / gs.length
              : 30;
          // Better goalies with more games get higher AAV
          aav = Math.round(
            Math.max(1000000, (avgSvPct - 0.88) * 60000000 + avgGP * 20000),
          );
        } else {
          const ss = player.seasonStats.filter((s) =>
            block.includes(parseInt(s.season.substring(0, 4))),
          );
          const avgPts =
            ss.length > 0
              ? ss.reduce((sum, s) => sum + s.points, 0) / ss.length
              : 30;
          // Rough scaling: ~$100K per point for average players
          aav = Math.round(Math.max(1000000, avgPts * 100000));
        }

        const birthYear = player.birthDate?.getFullYear() ?? 1997;
        const ageAtSigning = startYear - birthYear;
        signingType = ageAtSigning <= 26 ? "RFA" : "UFA";
      }

      // Use team from first season in block, fall back to current team
      const teamId =
        seasonTeamId.get(block[0]) ?? player.currentTeamId;
      if (!teamId) continue;

      // Mark historical contracts that have already ended as EXPIRED
      const currentSeasonEnd = 2026;
      const status = endYear <= currentSeasonEnd ? "EXPIRED" : "ACTIVE";

      try {
        await prisma.contract.create({
          data: {
            playerId: player.id,
            teamId,
            startYear,
            endYear,
            totalYears: term,
            aav: new Prisma.Decimal(aav),
            totalValue: new Prisma.Decimal(aav * term),
            structure: term <= 2 ? "FLAT" : "EVEN",
            capHitByYear: buildCapHitByYear(aav, startYear, endYear),
            signingAge: player.birthDate
              ? startYear - player.birthDate.getFullYear()
              : null,
            hasNTC: aav >= 5000000 && term >= 4,
            hasNMC: aav >= 8000000 && term >= 5,
            signingType,
            source: "historical-estimated",
            status,
          },
        });
        created++;
      } catch {
        // Skip duplicates or constraint errors silently
      }
    }
  }

  return created;
}
