const NHL_API_BASE = "https://api-web.nhle.com/v1";
const MAX_REQUESTS_PER_SECOND = 20;
const MAX_RETRIES = 3;
const RETRY_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

class RateLimiter {
  private timestamps: number[] = [];

  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < 1000);

    if (this.timestamps.length >= MAX_REQUESTS_PER_SECOND) {
      const waitTime = 1000 - (now - this.timestamps[0]);
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
      this.timestamps = this.timestamps.filter((t) => Date.now() - t < 1000);
    }

    this.timestamps.push(Date.now());
  }
}

const rateLimiter = new RateLimiter();

export class NHLApiError extends Error {
  constructor(
    public status: number,
    public url: string,
    message: string,
  ) {
    super(message);
    this.name = "NHLApiError";
  }
}

async function fetchWithRetry<T>(path: string): Promise<T> {
  const url = `${NHL_API_BASE}${path}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await rateLimiter.acquire();

      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      if (RETRY_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        console.warn(
          `[NHL API] ${response.status} on ${path}, retry ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay)}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw new NHLApiError(
        response.status,
        url,
        `NHL API error: ${response.status} ${response.statusText}`,
      );
    } catch (error) {
      if (error instanceof NHLApiError) throw error;

      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        console.warn(
          `[NHL API] Network error on ${path}, retry ${attempt + 1}/${MAX_RETRIES}: ${error instanceof Error ? error.message : error}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw new NHLApiError(
        0,
        url,
        `NHL API network error after ${MAX_RETRIES} retries: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  throw new NHLApiError(0, url, "Exhausted retries");
}

export const nhlClient = {
  getStandings: () =>
    fetchWithRetry<import("@/lib/nhl-api-types").NHLStandingsResponse>(
      "/standings/now",
    ),

  getRoster: (teamAbbrev: string) =>
    fetchWithRetry<import("@/lib/nhl-api-types").NHLRosterResponse>(
      `/roster/${teamAbbrev}/current`,
    ),

  getPlayerLanding: (playerId: number) =>
    fetchWithRetry<import("@/lib/nhl-api-types").NHLPlayerLanding>(
      `/player/${playerId}/landing`,
    ),
};
