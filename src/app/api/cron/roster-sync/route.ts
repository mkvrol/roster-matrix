import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nhlClient } from "@/server/services/nhl-api/nhl-client";
import type { NHLRosterPlayer } from "@/lib/nhl-api-types";
import type { Position } from "@prisma/client";
import { verifyCronAuth } from "../_auth";

export const maxDuration = 300;

function mapPosition(positionCode: string): Position {
  switch (positionCode) {
    case "C": return "C";
    case "L": return "LW";
    case "R": return "RW";
    case "D": return "D";
    case "G": return "G";
    default: return "C";
  }
}

function parseBirthDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(request: NextRequest) {
  if (!(await verifyCronAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  console.log(`[Cron:RosterSync] Starting at ${startedAt.toISOString()}`);

  const jobRun = await prisma.jobRun.create({
    data: { jobName: "cron-roster-sync", status: "started", startedAt },
  });

  const result = {
    playersUpdated: 0,
    playersCreated: 0,
    teamChanges: 0,
    transactionsCreated: 0,
    errors: [] as string[],
  };

  try {
    const teams = await prisma.team.findMany({
      select: { id: true, abbreviation: true, name: true },
    });
    const teamByAbbrev = new Map(teams.map((t) => [t.abbreviation, t]));

    // Snapshot current player→team mapping before sync
    const playersBefore = await prisma.player.findMany({
      where: { isActive: true, currentTeamId: { not: null } },
      select: { nhlApiId: true, fullName: true, currentTeamId: true },
    });
    const prevTeamMap = new Map(
      playersBefore.map((p) => [p.nhlApiId, { teamId: p.currentTeamId!, name: p.fullName }]),
    );

    // Sync rosters for all teams
    for (const team of teams) {
      try {
        const roster = await nhlClient.getRoster(team.abbreviation);
        const allPlayers: NHLRosterPlayer[] = [
          ...(roster.forwards ?? []),
          ...(roster.defensemen ?? []),
          ...(roster.goalies ?? []),
        ];

        for (const player of allPlayers) {
          if (!player.id) continue;

          const firstName = player.firstName?.default ?? "Unknown";
          const lastName = player.lastName?.default ?? "Unknown";

          const existing = await prisma.player.findUnique({
            where: { nhlApiId: player.id },
            select: { id: true, currentTeamId: true },
          });

          if (existing) {
            await prisma.player.update({
              where: { nhlApiId: player.id },
              data: {
                firstName,
                lastName,
                fullName: `${firstName} ${lastName}`,
                position: mapPosition(player.positionCode),
                shootsCatches: player.shootsCatches ?? null,
                birthDate: parseBirthDate(player.birthDate),
                heightInches: player.heightInInches ?? null,
                weightLbs: player.weightInPounds ?? null,
                isActive: true,
                headshotUrl: player.headshot ?? null,
                currentTeamId: team.id,
              },
            });
            result.playersUpdated++;

            // Detect team change → create trade transaction
            if (existing.currentTeamId && existing.currentTeamId !== team.id) {
              result.teamChanges++;
              const oldTeam = teams.find((t) => t.id === existing.currentTeamId);
              const playerName = `${firstName} ${lastName}`;
              const today = new Date();

              // Transaction on new team
              await prisma.transaction.create({
                data: {
                  teamId: team.id,
                  type: "TRADE",
                  description: `Acquired ${playerName} from ${oldTeam?.name ?? "Unknown"}`,
                  playersInvolved: [{ playerId: existing.id, name: playerName }],
                  date: today,
                },
              });

              // Transaction on old team
              if (oldTeam) {
                await prisma.transaction.create({
                  data: {
                    teamId: oldTeam.id,
                    type: "TRADE",
                    description: `Traded ${playerName} to ${team.name}`,
                    playersInvolved: [{ playerId: existing.id, name: playerName }],
                    date: today,
                  },
                });
              }

              result.transactionsCreated += oldTeam ? 2 : 1;
            }
          } else {
            await prisma.player.create({
              data: {
                nhlApiId: player.id,
                firstName,
                lastName,
                fullName: `${firstName} ${lastName}`,
                position: mapPosition(player.positionCode),
                shootsCatches: player.shootsCatches ?? null,
                birthDate: parseBirthDate(player.birthDate),
                birthCity: player.birthCity?.default ?? null,
                birthCountry: player.birthCountry ?? null,
                heightInches: player.heightInInches ?? null,
                weightLbs: player.weightInPounds ?? null,
                isActive: true,
                headshotUrl: player.headshot ?? null,
                currentTeamId: team.id,
              },
            });
            result.playersCreated++;
          }
        }
      } catch (error) {
        result.errors.push(
          `${team.abbreviation}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: { status: "completed", completedAt, durationMs, result: result as object },
    });

    console.log(
      `[Cron:RosterSync] Complete in ${durationMs}ms — ${result.playersUpdated} updated, ${result.playersCreated} created, ${result.teamChanges} team changes, ${result.transactionsCreated} transactions`,
    );

    return NextResponse.json(result);
  } catch (error) {
    const completedAt = new Date();
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "failed",
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        error: error instanceof Error ? error.message : String(error),
      },
    });

    console.error("[Cron:RosterSync] Fatal:", error);
    return NextResponse.json(
      { error: "Roster sync failed", message: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
