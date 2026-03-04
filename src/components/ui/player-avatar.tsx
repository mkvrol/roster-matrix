"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const SIZE_MAP = {
  sm: { px: 28, text: "text-[10px]" },
  md: { px: 40, text: "text-sm" },
  lg: { px: 56, text: "text-lg" },
  xl: { px: 80, text: "text-2xl" },
} as const;

type AvatarSize = keyof typeof SIZE_MAP;

interface PlayerAvatarProps {
  headshotUrl?: string | null;
  nhlApiId?: number | null;
  teamAbbrev?: string | null;
  firstName: string;
  lastName: string;
  size?: AvatarSize;
  className?: string;
}

function getNhlCdnUrl(nhlApiId: number, teamAbbrev: string): string {
  return `https://assets.nhle.com/mugs/nhl/20252026/${teamAbbrev}/${nhlApiId}.png`;
}

export function PlayerAvatar({
  headshotUrl,
  nhlApiId,
  teamAbbrev,
  firstName,
  lastName,
  size = "md",
  className,
}: PlayerAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [cdnFailed, setCdnFailed] = useState(false);
  const { px, text } = SIZE_MAP[size];

  const primarySrc = headshotUrl || null;
  const fallbackSrc = nhlApiId && teamAbbrev ? getNhlCdnUrl(nhlApiId, teamAbbrev) : null;

  const src = primarySrc && !imgFailed
    ? primarySrc
    : fallbackSrc && !cdnFailed
      ? fallbackSrc
      : null;

  if (!src) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full border-2 border-border-subtle bg-surface-2 font-semibold text-text-muted",
          text,
          className,
        )}
        style={{ width: px, height: px }}
      >
        {firstName[0]}
        {lastName[0]}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={`${firstName} ${lastName}`}
      width={px}
      height={px}
      className={cn(
        "shrink-0 rounded-full border-2 border-border-subtle bg-surface-2 object-cover",
        className,
      )}
      onError={() => {
        if (primarySrc && !imgFailed) {
          setImgFailed(true);
        } else {
          setCdnFailed(true);
        }
      }}
    />
  );
}
