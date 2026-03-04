// ──────────────────────────────────────────────
// Roster Matrix — AI Service (Anthropic Claude)
// Shared Claude client and prompt helpers
// ──────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";
import { TRPCError } from "@trpc/server";

const MODEL = "claude-sonnet-4-5-20250929";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

let client: Anthropic | null = null;

export function getAIClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }
  return client;
}

export function isAIEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    return err.status === 529 || err.status === 503;
  }
  return false;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (isRetryableError(err) && attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt); // 2s, 4s, 8s
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (isRetryableError(err)) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message:
            "AI service is temporarily busy. Please try again in a moment.",
        });
      }
      throw err;
    }
  }
  throw new Error("Unreachable");
}

export const SYSTEM_PROMPT = `You are an elite NHL contract analytics assistant embedded in "Roster Matrix," a professional analytics platform used by NHL General Managers, agents, and executives.

Key context:
- Value scores range from 0–99 (higher = better value relative to contract)
- Score 75+ = significantly outperforming contract
- Score 60–74 = outperforming
- Score 45–59 = fair value
- Score 30–44 = underperforming
- Score below 30 = significantly underperforming
- The current salary cap is $95.5M
- Positions: C (Center), LW (Left Wing), RW (Right Wing), D (Defense), G (Goalie)
- AAV = Average Annual Value of a contract
- NMC = No-Movement Clause, NTC = No-Trade Clause

Always be precise with numbers. Use executive-level language — concise, data-backed, actionable. Never fabricate player data; only use what is provided to you.`;

export async function generateText(
  userPrompt: string,
  options?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  const ai = getAIClient();
  const response = await withRetry(() =>
    ai.messages.create({
      model: MODEL,
      max_tokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.3,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  );

  const block = response.content[0];
  if (block.type === "text") return block.text;
  return "";
}

export async function generateJSON<T>(
  userPrompt: string,
  options?: { maxTokens?: number },
): Promise<T> {
  const ai = getAIClient();
  const response = await withRetry(() =>
    ai.messages.create({
      model: MODEL,
      max_tokens: options?.maxTokens ?? 2048,
      temperature: 0,
      system:
        SYSTEM_PROMPT +
        "\n\nYou MUST respond with valid JSON only. No markdown, no code fences, no explanation outside the JSON.",
      messages: [{ role: "user", content: userPrompt }],
    }),
  );

  const block = response.content[0];
  if (block.type === "text") return JSON.parse(block.text) as T;
  throw new Error("Unexpected response format from AI");
}

export { MODEL, withRetry };
