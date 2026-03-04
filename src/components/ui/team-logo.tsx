"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const SIZE_MAP = {
  sm: 20,
  md: 28,
  lg: 40,
  xl: 60,
} as const;

type TeamLogoSize = keyof typeof SIZE_MAP;

interface TeamLogoProps {
  teamAbbrev: string | null | undefined;
  size?: TeamLogoSize;
  className?: string;
}

function getLogoUrl(teamAbbrev: string | null | undefined): string {
  const abbrev = teamAbbrev?.toUpperCase() || "NHL";
  return `https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg`;
}

export function TeamLogo({ teamAbbrev, size = "md", className }: TeamLogoProps) {
  const [error, setError] = useState(false);
  const px = SIZE_MAP[size];

  if (error) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded bg-surface-2 font-mono text-text-muted",
          size === "sm" && "text-[9px]",
          size === "md" && "text-[10px]",
          size === "lg" && "text-data-xs",
          size === "xl" && "text-data-sm",
          className,
        )}
        style={{ width: px, height: px }}
      >
        {teamAbbrev ?? "NHL"}
      </span>
    );
  }

  return (
    <img
      src={getLogoUrl(teamAbbrev)}
      alt={teamAbbrev ? `${teamAbbrev} logo` : "NHL logo"}
      width={px}
      height={px}
      className={cn("shrink-0 object-contain", className)}
      onError={() => setError(true)}
    />
  );
}
