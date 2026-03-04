import { cn } from "@/lib/utils";

function getGaugeColor(score: number): string {
  if (score >= 90) return "#10b981";
  if (score >= 75) return "#60a5fa";
  if (score >= 60) return "#fbbf24";
  if (score >= 40) return "#a78bfa";
  return "#ef4444";
}

interface ValueGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ValueGauge({
  score,
  size = 80,
  strokeWidth = 5,
  className,
}: ValueGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 99);
  const offset = circumference - (progress / 99) * circumference;
  const color = getGaugeColor(score);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          className="font-mono text-lg font-bold tabular-nums leading-none"
          style={{ color }}
        >
          {score}
        </span>
      </div>
    </div>
  );
}
