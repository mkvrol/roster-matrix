import { cn } from "@/lib/utils";

type ValueTier = "ELITE" | "STRONG" | "FAIR" | "BELOW" | "OVERPAID";

const tierConfig: Record<ValueTier, { label: string; bg: string; text: string }> = {
  ELITE: { label: "ELITE VALUE", bg: "bg-success-muted", text: "text-success" },
  STRONG: { label: "STRONG VALUE", bg: "bg-info-muted", text: "text-info" },
  FAIR: { label: "FAIR VALUE", bg: "bg-warning-muted", text: "text-warning" },
  BELOW: { label: "BELOW VALUE", bg: "bg-purple-muted", text: "text-purple" },
  OVERPAID: { label: "OVERPAID", bg: "bg-danger-muted", text: "text-danger" },
};

export function getValueTier(score: number): ValueTier {
  if (score >= 85) return "ELITE";
  if (score >= 70) return "STRONG";
  if (score >= 55) return "FAIR";
  if (score >= 40) return "BELOW";
  return "OVERPAID";
}

interface ValueBadgeProps {
  score: number;
  tier?: ValueTier;
  showScore?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function ValueBadge({
  score,
  tier,
  showScore = true,
  size = "md",
  className,
}: ValueBadgeProps) {
  const resolvedTier = tier ?? getValueTier(score);
  const config = tierConfig[resolvedTier];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded font-mono font-medium uppercase tracking-wider",
        config.bg,
        config.text,
        size === "sm" ? "px-1.5 py-0.5 text-data-xs" : "px-2 py-1 text-data-sm",
        className,
      )}
    >
      {showScore && <span className="font-semibold">{score}</span>}
      <span>{config.label}</span>
    </span>
  );
}
