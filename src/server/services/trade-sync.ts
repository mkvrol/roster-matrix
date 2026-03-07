// ──────────────────────────────────────────────
// Trade Sync — Fetch full trade details from NHL Forge API
// Parses trade stories into structured two-sided trade data
// ──────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { generateJSON, isAIEnabled } from "@/server/services/ai";

const FORGE_API =
  "https://forge-dapi.d3.nhle.com/v2/content/en-us/stories";

interface TradeStory {
  headline: string;
  summary: string;
  contentDate: string;
  slug: string;
  tags: Array<{ slug: string; title: string }>;
}

interface TradeSide {
  teamId: string;
  abbreviation: string;
  name: string;
  sends: string[]; // player names, picks, etc
}

/**
 * Fetch recent trade stories from the NHL Forge content API.
 * Paginate to get all recent stories.
 */
async function fetchTradeStories(since: Date): Promise<TradeStory[]> {
  const all: TradeStory[] = [];

  for (let skip = 0; skip < 100; skip += 50) {
    const url = `${FORGE_API}?tags.slug=trade&context.slug=nhl&$limit=50&$skip=${skip}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) break;
    const data = (await res.json()) as { items: TradeStory[] };
    if (data.items.length === 0) break;

    for (const story of data.items) {
      const storyDate = new Date(story.contentDate);
      if (storyDate < since) continue;
      // Must have at least 2 team tags to be an actual trade article
      const teamTags = story.tags.filter((t) => t.slug.startsWith("teamid-"));
      if (teamTags.length >= 2) all.push(story);
    }

    // If the oldest story in this batch is before our cutoff, stop paginating
    const oldest = data.items[data.items.length - 1];
    if (oldest && new Date(oldest.contentDate) < since) break;
  }

  return all;
}

/**
 * Parse the NHL summary into what each team sends.
 *
 * NHL summaries follow patterns like:
 *  - "Bobby McMann was traded to the Seattle Kraken by the Toronto Maple Leafs
 *     for a fourth-round pick in the 2026 NHL Draft and a conditional
 *     second-round pick in the 2027 NHL Draft."
 *  - "Nazem Kadri was traded back to the Colorado Avalanche by the Calgary Flames.
 *     The Flames received forward Victor Olofsson, unsigned forward prospect
 *     Maxmilian Curran, a conditional first-round pick in the 2028 NHL Draft ..."
 *
 * We extract the first 1-2 sentences, then parse "for {assets}" and
 * "{Team} received {assets}" patterns.
 */
function parseTradeSides(
  summary: string,
  team1Name: string,
  team2Name: string,
): { team1Sends: string[]; team2Sends: string[] } {
  // Take trade-relevant sentences (before analysis/quotes)
  const sentences = summary.split(/\n/)[0].split(/(?<=[.])\s+/);
  const tradeText = sentences
    .filter(
      (s) =>
        s.includes("traded") ||
        s.includes("received") ||
        s.includes(" for ") ||
        (!s.startsWith('"') &&
         !s.includes("season") &&
         !s.includes("said")),
    )
    .slice(0, 3)
    .join(" ");

  // Short team name for matching ("Toronto Maple Leafs" -> "Maple Leafs", "Toronto")
  const team1Short = team1Name.split(" ").pop() ?? team1Name;
  const team2Short = team2Name.split(" ").pop() ?? team2Name;

  const team1Sends: string[] = [];
  const team2Sends: string[] = [];

  // Pattern 1: "X was traded to {team1} by {team2} for {assets}"
  // In this case: team2 sends X, team1 sends {assets}
  const tradedToMatch = tradeText.match(
    /^([\s\S]+?)\s+(?:was|were)\s+traded\s+(?:back\s+)?to\s+(?:the\s+)?([\s\S]+?)\s+by\s+(?:the\s+)?([\s\S]+?)\s+(?:on\s+\w+\s+)?for\s+([\s\S]+?)\.?$/,
  );

  if (tradedToMatch) {
    const playerTraded = cleanPlayerName(tradedToMatch[1]);
    const toTeam = tradedToMatch[2];
    const assets = tradedToMatch[4];

    // Determine which team is "to" and which is "by"
    if (toTeam.includes(team1Short) || toTeam.includes(team1Name.split(" ")[0])) {
      // team2 sends the player(s), team1 sends the assets
      team2Sends.push(...splitPlayers(playerTraded));
      team1Sends.push(...parseAssets(assets));
    } else {
      team1Sends.push(...splitPlayers(playerTraded));
      team2Sends.push(...parseAssets(assets));
    }

    return { team1Sends, team2Sends };
  }

  // Pattern 2: "X traded to {team1} by {team2} for {assets}" (without "was")
  const tradedToMatch2 = tradeText.match(
    /^([\s\S]+?)\s+traded\s+(?:back\s+)?to\s+(?:the\s+)?([\s\S]+?)\s+by\s+(?:the\s+)?([\s\S]+?)\s+for\s+([\s\S]+?)\.?$/,
  );

  if (tradedToMatch2) {
    const playerTraded = cleanPlayerName(tradedToMatch2[1]);
    const toTeam = tradedToMatch2[2];
    const assets = tradedToMatch2[4];

    if (toTeam.includes(team1Short) || toTeam.includes(team1Name.split(" ")[0])) {
      team2Sends.push(...splitPlayers(playerTraded));
      team1Sends.push(...parseAssets(assets));
    } else {
      team1Sends.push(...splitPlayers(playerTraded));
      team2Sends.push(...parseAssets(assets));
    }

    return { team1Sends, team2Sends };
  }

  // Pattern 3: Two-sentence trade — "X were traded to {team} by {team}.\n{team} received Y"
  const twoPartMatch = tradeText.match(
    /^([\s\S]+?)\s+(?:was|were)\s+traded\s+(?:back\s+)?to\s+(?:the\s+)?([\s\S]+?)\s+by\s+(?:the\s+)?([\s\S]+?)(?:\s+on\s+\w+)?[.]/,
  );
  if (twoPartMatch) {
    const playerTraded = cleanPlayerName(twoPartMatch[1]);
    const toTeam = twoPartMatch[2];
    const receivedMatch = tradeText.match(
      /received\s+([\s\S]+?)(?:\.|$)/,
    );

    if (toTeam.includes(team1Short) || toTeam.includes(team1Name.split(" ")[0])) {
      team2Sends.push(...splitPlayers(playerTraded));
      if (receivedMatch) {
        team1Sends.push(...parseAssets(receivedMatch[1]));
      }
    } else {
      team1Sends.push(...splitPlayers(playerTraded));
      if (receivedMatch) {
        team2Sends.push(...parseAssets(receivedMatch[1]));
      }
    }

    return { team1Sends, team2Sends };
  }

  // Fallback: just use headline
  return { team1Sends, team2Sends };
}

function cleanPlayerName(name: string): string {
  // Remove position prefixes like "forward ", "defenseman ", "goalie "
  return name
    .replace(/^(?:forward|defenseman|defensemen|goalie|goaltender|center|winger)\s+/i, "")
    .trim();
}

function splitPlayers(text: string): string[] {
  // "Logan Stanley and Luke Schenn" -> ["Logan Stanley", "Luke Schenn"]
  // "Bobby McMann" -> ["Bobby McMann"]
  return text
    .split(/\s+and\s+|\s*,\s+/)
    .map((s) => cleanPlayerName(s.trim()))
    .filter(Boolean);
}

function parseAssets(text: string): string[] {
  // Split on ", " and " and " but keep pick descriptions together
  // "a fourth-round pick in the 2026 NHL Draft and a conditional second-round pick in the 2027 NHL Draft"
  const items: string[] = [];
  const parts = text.split(/,\s+(?:and\s+)?|\s+and\s+/);

  for (const part of parts) {
    const cleaned = part
      .replace(/^a\s+/i, "")
      .replace(/\s+in the \d{4} NHL Draft/i, "")
      .replace(/\s+in the \d{4} Draft/i, "")
      .replace(/\s+in \d{4}/i, "")
      .replace(/^(?:forward|defenseman|defensemen|goalie|goaltender|center|winger|unsigned forward prospect)\s+/i, "")
      .trim();
    if (!cleaned) continue;

    // Format picks nicely: "conditional first-round pick" -> "Cond. 1st (2028)"
    const pickMatch = part.match(
      /(conditional\s+)?(\w+)-round\s+(?:pick|selection)(?:\s+in\s+(?:the\s+)?(\d{4}))?/i,
    );
    if (pickMatch) {
      const cond = pickMatch[1] ? "Cond. " : "";
      const round = pickMatch[2]
        .replace(/first/i, "1st")
        .replace(/second/i, "2nd")
        .replace(/third/i, "3rd")
        .replace(/fourth/i, "4th")
        .replace(/fifth/i, "5th")
        .replace(/sixth/i, "6th")
        .replace(/seventh/i, "7th");
      const year = pickMatch[3] ?? "";
      items.push(`${cond}${round}${year ? ` (${year})` : ""}`);
      continue;
    }

    // "future considerations"
    if (cleaned.toLowerCase().includes("future considerations")) {
      items.push("Future considerations");
      continue;
    }

    items.push(cleaned);
  }

  return items;
}

/**
 * Main sync function: fetch trades from NHL, match teams/players in DB,
 * create Transaction records with structured two-sided trade data.
 */
/**
 * Use AI to fill in missing trade return details for incomplete trades.
 * Makes a single batch call with all incomplete trades to minimize API usage.
 */
async function enrichIncompleteTrades(
  trades: Array<{
    id: string;
    description: string;
    team1Abbrev: string;
    team2Abbrev: string;
    team1Sends: string[];
    team2Sends: string[];
  }>,
): Promise<Map<string, string[]>> {
  if (!isAIEnabled() || trades.length === 0) return new Map();

  const tradeList = trades.map((t) => {
    const knownSide = t.team1Sends.length > 0
      ? `${t.team1Abbrev} sends: ${t.team1Sends.join(", ")}`
      : `${t.team2Abbrev} sends: ${t.team2Sends.join(", ")}`;
    return `- "${t.description}" (${knownSide}, other side unknown)`;
  }).join("\n");

  try {
    const result = await generateJSON<Array<{
      id: string;
      returnAssets: string[];
    }>>(
      `You are an NHL trade expert. Here are recent NHL trades where we only know one side of the deal. For each trade, tell me what was sent in return based on your knowledge of these trades.\n\nTrades:\n${tradeList}\n\nRespond with a JSON array. For each trade, provide the return assets (player names, draft picks like "2027 2nd", etc.). Use short formats: "2027 1st", "Cond. 2026 3rd", player last names for well-known players. IDs: ${trades.map((t) => `"${t.id}"`).join(", ")}\n\nFormat: [{"id": "...", "returnAssets": ["2027 2nd", "Player Name"]}]`,
      { maxTokens: 1024 },
    );
    const map = new Map<string, string[]>();
    for (const item of result) {
      if (item.id && Array.isArray(item.returnAssets)) {
        map.set(item.id, item.returnAssets);
      }
    }
    return map;
  } catch (err) {
    console.error("[TradeSync] AI enrichment failed:", err);
    return new Map();
  }
}

export async function syncTrades(): Promise<{
  tradesFound: number;
  tradesCreated: number;
  skipped: number;
  enriched: number;
  errors: string[];
}> {
  const result = {
    tradesFound: 0,
    tradesCreated: 0,
    skipped: 0,
    enriched: 0,
    errors: [] as string[],
  };

  // Look back 7 days to catch trades we might have missed
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const stories = await fetchTradeStories(since);
  result.tradesFound = stories.length;

  // Load our teams by nhlApiId for matching
  const teams = await prisma.team.findMany({
    select: { id: true, nhlApiId: true, abbreviation: true, name: true },
  });
  const teamByNhlId = new Map(teams.map((t) => [t.nhlApiId, t]));

  // Load existing trade transaction slugs to avoid duplicates
  const existingTrades = await prisma.transaction.findMany({
    where: { type: "TRADE", date: { gte: since } },
    select: { id: true, playersInvolved: true },
  });

  const existingSlugs = new Set<string>();
  for (const tx of existingTrades) {
    const involved = tx.playersInvolved as Record<string, unknown> | null;
    if (involved && typeof involved === "object" && "sourceSlug" in involved) {
      existingSlugs.add(involved.sourceSlug as string);
    }
  }

  // Track trades that need AI enrichment (one side is empty)
  const incompleteTrades: Array<{
    id: string;
    description: string;
    team1Abbrev: string;
    team2Abbrev: string;
    team1Sends: string[];
    team2Sends: string[];
  }> = [];

  for (const story of stories) {
    if (existingSlugs.has(story.slug)) {
      result.skipped++;
      continue;
    }

    const teamTags = story.tags.filter((t) => t.slug.startsWith("teamid-"));
    const playerTags = story.tags.filter((t) => t.slug.startsWith("playerid-"));

    if (teamTags.length < 2) {
      result.errors.push(`<2 teams: ${story.headline}`);
      continue;
    }

    const team1NhlId = parseInt(teamTags[0].slug.replace("teamid-", ""), 10);
    const team2NhlId = parseInt(teamTags[1].slug.replace("teamid-", ""), 10);
    const dbTeam1 = teamByNhlId.get(team1NhlId);
    const dbTeam2 = teamByNhlId.get(team2NhlId);

    if (!dbTeam1 || !dbTeam2) {
      result.errors.push(`Unknown team(s): ${story.headline}`);
      continue;
    }

    // Parse the summary into structured sends for each team
    const { team1Sends, team2Sends } = parseTradeSides(
      story.summary,
      teamTags[0].title,
      teamTags[1].title,
    );

    // Find players in our DB
    const playerNhlIds = playerTags.map((t) =>
      parseInt(t.slug.replace("playerid-", ""), 10),
    );
    const players =
      playerNhlIds.length > 0
        ? await prisma.player.findMany({
            where: { nhlApiId: { in: playerNhlIds } },
            select: { id: true, nhlApiId: true, fullName: true },
          })
        : [];

    // Delete old roster-sync transactions that overlap with this trade
    const dateStr = new Date(story.contentDate).toISOString().slice(0, 10);
    const playerNames = players.map((p) => p.fullName);
    if (playerNames.length > 0) {
      await prisma.transaction.deleteMany({
        where: {
          type: "TRADE",
          date: {
            gte: new Date(dateStr + "T00:00:00Z"),
            lte: new Date(dateStr + "T23:59:59Z"),
          },
          OR: playerNames.map((name) => ({
            description: { contains: name },
          })),
        },
      });
    }

    const created = await prisma.transaction.create({
      data: {
        teamId: dbTeam1.id,
        type: "TRADE",
        description: story.headline,
        playersInvolved: {
          sourceSlug: story.slug,
          team1: {
            teamId: dbTeam1.id,
            abbreviation: dbTeam1.abbreviation,
            name: dbTeam1.name,
            sends: team1Sends,
          },
          team2: {
            teamId: dbTeam2.id,
            abbreviation: dbTeam2.abbreviation,
            name: dbTeam2.name,
            sends: team2Sends,
          },
        },
        date: new Date(story.contentDate),
      },
    });

    // Track if one side is empty for AI enrichment
    if (
      (team1Sends.length === 0 && team2Sends.length > 0) ||
      (team2Sends.length === 0 && team1Sends.length > 0)
    ) {
      incompleteTrades.push({
        id: created.id,
        description: story.headline,
        team1Abbrev: dbTeam1.abbreviation,
        team2Abbrev: dbTeam2.abbreviation,
        team1Sends,
        team2Sends,
      });
    }

    result.tradesCreated++;
  }

  // AI enrichment: fill in missing sides for incomplete trades
  if (incompleteTrades.length > 0) {
    const enrichments = await enrichIncompleteTrades(incompleteTrades);
    for (const trade of incompleteTrades) {
      const returnAssets = enrichments.get(trade.id);
      if (!returnAssets || returnAssets.length === 0) continue;

      // Fetch current data to update the empty side
      const tx = await prisma.transaction.findUnique({
        where: { id: trade.id },
        select: { playersInvolved: true },
      });
      if (!tx) continue;

      const involved = tx.playersInvolved as Record<string, Record<string, unknown>>;
      if (trade.team1Sends.length === 0) {
        involved.team1.sends = returnAssets;
      } else {
        involved.team2.sends = returnAssets;
      }

      await prisma.transaction.update({
        where: { id: trade.id },
        data: { playersInvolved: JSON.parse(JSON.stringify(involved)) },
      });
      result.enriched++;
    }
  }

  // Also enrich any existing roster-sync trades that lack structured data
  await enrichRosterSyncTrades(since);

  return result;
}

/**
 * Find roster-sync trades (no team1/team2 structure) and enrich them with AI.
 */
async function enrichRosterSyncTrades(since: Date): Promise<void> {
  if (!isAIEnabled()) return;

  const rosterTrades = await prisma.transaction.findMany({
    where: { type: "TRADE", date: { gte: since } },
    select: {
      id: true,
      description: true,
      playersInvolved: true,
      team: { select: { abbreviation: true } },
    },
  });

  // Find trades that only have roster-sync format (no team1/team2 structure)
  // and where one side is missing or has "Draft pick(s)"
  const needsEnrichment: Array<{
    id: string;
    description: string;
    team1Abbrev: string;
    team2Abbrev: string;
    team1Sends: string[];
    team2Sends: string[];
  }> = [];

  for (const tx of rosterTrades) {
    const involved = tx.playersInvolved as Record<string, unknown> | null;
    if (!involved || typeof involved !== "object") continue;
    if (!("team1" in involved) || !("team2" in involved)) continue;

    const t1 = involved.team1 as { abbreviation: string; sends: string[] };
    const t2 = involved.team2 as { abbreviation: string; sends: string[] };

    const t1Empty = !t1.sends || t1.sends.length === 0 || (t1.sends.length === 1 && t1.sends[0] === "Draft pick(s)");
    const t2Empty = !t2.sends || t2.sends.length === 0 || (t2.sends.length === 1 && t2.sends[0] === "Draft pick(s)");

    if ((t1Empty && !t2Empty) || (t2Empty && !t1Empty)) {
      needsEnrichment.push({
        id: tx.id,
        description: tx.description,
        team1Abbrev: t1.abbreviation,
        team2Abbrev: t2.abbreviation,
        team1Sends: t1Empty ? [] : t1.sends,
        team2Sends: t2Empty ? [] : t2.sends,
      });
    }
  }

  if (needsEnrichment.length === 0) return;

  const enrichments = await enrichIncompleteTrades(needsEnrichment);
  for (const trade of needsEnrichment) {
    const returnAssets = enrichments.get(trade.id);
    if (!returnAssets || returnAssets.length === 0) continue;

    const tx = await prisma.transaction.findUnique({
      where: { id: trade.id },
      select: { playersInvolved: true },
    });
    if (!tx) continue;

    const involved = tx.playersInvolved as Record<string, Record<string, unknown>>;
    if (trade.team1Sends.length === 0) {
      involved.team1.sends = returnAssets;
    } else {
      involved.team2.sends = returnAssets;
    }

    await prisma.transaction.update({
      where: { id: trade.id },
      data: { playersInvolved: JSON.parse(JSON.stringify(involved)) },
    });
  }
}
