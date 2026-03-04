"use client";

import { TeamPageContent } from "../team-content";

export default function TeamByAbbrevPage({
  params,
}: {
  params: { teamAbbrev: string };
}) {
  return <TeamPageContent initialAbbrev={params.teamAbbrev.toUpperCase()} />;
}
