// ──────────────────────────────────────────────
// Trade Sync — Fetch full trade details from NHL Forge API
// Parses the NHL Trade Tracker for complete trade data
// including players, picks, conditions, and salary retained
// ──────────────────────────────────────────────

import { prisma } from "@/lib/prisma";

const FORGE_API =
  "https://forge-dapi.d3.nhle.com/v2/content/en-us/stories";

interface TradeStory {
  headline: string;
  summary: string;
  contentDate: string;
  slug: string;
  tags: Array<{ slug: string; title: string }>;
}

interface ParsedTrade {
  date: Date;
  headline: string;
  summary: string;
  slug: string;
  team1: { nhlApiId: number; name: string };
  team2: { nhlApiId: number; name: string };
  playerNhlIds: number[];
  description: string;
}

/**
 * Fetch recent trade stories from the NHL Forge content API.
 * Each trade article is tagged with teamid-X and playerid-X.
 */
async function fetchTradeStories(
  since: Date,
): Promise<TradeStory[]> {
  const url = `${FORGE_API}?tags.slug=trade&context.slug=nhl&$limit=50&$skip=0`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Forge API error: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as {
    items: TradeStory[];
  };

  // Filter to stories with exactly 2 team tags (actual trades, not roundups)
  // and after the since date
  return data.items.filter((story) => {
    const storyDate = new Date(story.contentDate);
    if (storyDate < since) return false;
    const teamTags = story.tags.filter((t) =>
      t.slug.startsWith("teamid-"),
    );
    return teamTags.length === 2;
  });
}

/**
 * Parse a trade story into structured trade data.
 */
function parseTradeStory(story: TradeStory): ParsedTrade | null {
  const teamTags = story.tags.filter((t) => t.slug.startsWith("teamid-"));
  const playerTags = story.tags.filter((t) =>
    t.slug.startsWith("playerid-"),
  );

  if (teamTags.length !== 2) return null;

  const team1NhlId = parseInt(teamTags[0].slug.replace("teamid-", ""), 10);
  const team2NhlId = parseInt(teamTags[1].slug.replace("teamid-", ""), 10);

  const playerNhlIds = playerTags.map((t) =>
    parseInt(t.slug.replace("playerid-", ""), 10),
  );

  // Use headline as primary description, summary for details.
  // The summary contains the full trade breakdown.
  // Build a clean one-line description from the summary.
  const description = buildDescription(story.summary);

  return {
    date: new Date(story.contentDate),
    headline: story.headline,
    summary: story.summary,
    slug: story.slug,
    team1: { nhlApiId: team1NhlId, name: teamTags[0].title },
    team2: { nhlApiId: team2NhlId, name: teamTags[1].title },
    playerNhlIds,
    description,
  };
}

/**
 * Extract the first 1-2 sentences from the NHL summary as the description.
 * NHL summaries follow: "{Player} was traded to {Team} by {Team} for {picks/players}."
 */
function buildDescription(summary: string): string {
  // Take first two sentences (the trade itself, before analysis)
  const sentences = summary.split(/(?<=[.!])\s+/);
  const tradeSentences: string[] = [];

  for (const s of sentences) {
    tradeSentences.push(s);
    // Stop after we have the trade details (usually 1-2 sentences)
    if (
      tradeSentences.length >= 2 ||
      (tradeSentences.length === 1 && s.includes(" for "))
    ) {
      break;
    }
  }

  return tradeSentences.join(" ").trim();
}

/**
 * Main sync function: fetch trades from NHL, match teams/players in DB,
 * create Transaction records for new trades.
 */
export async function syncTrades(): Promise<{
  tradesFound: number;
  tradesCreated: number;
  skipped: number;
  errors: string[];
}> {
  const result = {
    tradesFound: 0,
    tradesCreated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  // Look back 3 days to catch trades we might have missed
  const since = new Date();
  since.setDate(since.getDate() - 3);

  const stories = await fetchTradeStories(since);
  result.tradesFound = stories.length;

  // Load our teams by nhlApiId for matching
  const teams = await prisma.team.findMany({
    select: { id: true, nhlApiId: true, abbreviation: true, name: true },
  });
  const teamByNhlId = new Map(teams.map((t) => [t.nhlApiId, t]));

  // Load existing trade transaction slugs to avoid duplicates
  // We store the story slug in playersInvolved metadata
  const existingTrades = await prisma.transaction.findMany({
    where: {
      type: "TRADE",
      date: { gte: since },
    },
    select: { id: true, description: true, playersInvolved: true },
  });

  const existingSlugs = new Set<string>();
  for (const tx of existingTrades) {
    const involved = tx.playersInvolved as Record<string, unknown> | null;
    if (involved && typeof involved === "object" && "sourceSlug" in involved) {
      existingSlugs.add(involved.sourceSlug as string);
    }
  }

  for (const story of stories) {
    // Skip if we already synced this trade
    if (existingSlugs.has(story.slug)) {
      result.skipped++;
      continue;
    }

    const parsed = parseTradeStory(story);
    if (!parsed) {
      result.errors.push(`Failed to parse: ${story.headline}`);
      continue;
    }

    const dbTeam1 = teamByNhlId.get(parsed.team1.nhlApiId);
    const dbTeam2 = teamByNhlId.get(parsed.team2.nhlApiId);

    if (!dbTeam1 || !dbTeam2) {
      result.errors.push(
        `Unknown team(s) in: ${story.headline} (IDs: ${parsed.team1.nhlApiId}, ${parsed.team2.nhlApiId})`,
      );
      continue;
    }

    // Find players in our DB
    const players =
      parsed.playerNhlIds.length > 0
        ? await prisma.player.findMany({
            where: { nhlApiId: { in: parsed.playerNhlIds } },
            select: {
              id: true,
              nhlApiId: true,
              fullName: true,
              currentTeamId: true,
            },
          })
        : [];

    const playersByNhlId = new Map(
      players.map((p) => [p.nhlApiId, p]),
    );

    // Build structured playersInvolved data
    const team1Players = parsed.playerNhlIds
      .map((id) => playersByNhlId.get(id))
      .filter(
        (p) => p && p.currentTeamId === dbTeam1.id,
      )
      .map((p) => ({
        playerId: p!.id,
        name: p!.fullName,
        nhlApiId: p!.nhlApiId,
      }));

    const team2Players = parsed.playerNhlIds
      .map((id) => playersByNhlId.get(id))
      .filter(
        (p) => p && p.currentTeamId === dbTeam2.id,
      )
      .map((p) => ({
        playerId: p!.id,
        name: p!.fullName,
        nhlApiId: p!.nhlApiId,
      }));

    // Also check headline ordering — NHL headlines say "X traded to {team1} by {team2}"
    // The first team tag is usually the acquiring team

    // Check for existing roster-sync transactions that match this trade
    // and remove them to avoid duplicates
    const dateStr = parsed.date.toISOString().slice(0, 10);
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

    await prisma.transaction.create({
      data: {
        teamId: dbTeam1.id,
        type: "TRADE",
        description: parsed.description,
        playersInvolved: {
          sourceSlug: story.slug,
          headline: parsed.headline,
          team1: {
            teamId: dbTeam1.id,
            abbreviation: dbTeam1.abbreviation,
            name: dbTeam1.name,
            players: team1Players,
          },
          team2: {
            teamId: dbTeam2.id,
            abbreviation: dbTeam2.abbreviation,
            name: dbTeam2.name,
            players: team2Players,
          },
        },
        date: parsed.date,
      },
    });

    result.tradesCreated++;
  }

  return result;
}
