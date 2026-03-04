import { cn } from "@/lib/utils";

type StatCardVariant = "default" | "accent" | "success" | "warning" | "danger" | "info" | "purple";

const variantStyles: Record<StatCardVariant, string> = {
  default: "border-border-subtle",
  accent: "border-l-2 border-l-accent border-border-subtle",
  success: "border-l-2 border-l-success border-border-subtle",
  warning: "border-l-2 border-l-warning border-border-subtle",
  danger: "border-l-2 border-l-danger border-border-subtle",
  info: "border-l-2 border-l-info border-border-subtle",
  purple: "border-l-2 border-l-purple border-border-subtle",
};

interface StatCardProps {
  label: string;
  value: string | number;
  subText?: string;
  variant?: StatCardVariant;
  className?: string;
}

export function StatCard({
  label,
  value,
  subText,
  variant = "default",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-md border bg-surface-1 p-4",
        variantStyles[variant],
        className,
      )}
    >
      <p className="text-data-xs uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight text-text-primary">
        {value}
      </p>
      {subText && (
        <p className="mt-0.5 text-data-xs text-text-muted">{subText}</p>
      )}
    </div>
  );
}
