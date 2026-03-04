import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-2", className)}
      aria-hidden="true"
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-1 p-4">
      <Skeleton className="mb-2 h-3 w-20" />
      <Skeleton className="mb-1 h-7 w-16" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 6 }: { cols?: number }) {
  return (
    <tr className="border-b border-border-subtle">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-2">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function CardSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <div
      className={cn(
        "rounded-md border border-border-subtle bg-surface-1",
        height,
      )}
    >
      <div className="border-b border-border-subtle px-4 py-3">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="p-4">
        <Skeleton className="mb-3 h-4 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="flex h-64 items-center justify-center rounded-md border border-border-subtle bg-surface-1">
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-32 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}
