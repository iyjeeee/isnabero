import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "../lib/utils";

export interface TrendBadgeProps {
  // percentChange: null means there's no meaningful baseline to compare against (e.g. the previous
  // period had zero activity) — shown as a neutral dash rather than a misleading "+Infinity%".
  percentChange: number | null;
  label?: string;
  className?: string;
}

// TrendBadge: the one component for showing "up/down X% vs previous period" — used by Sales and
// Booking reports, and available for any future stat that needs a period comparison.
export function TrendBadge({ percentChange, label = "vs previous period", className }: TrendBadgeProps) {
  if (percentChange === null) {
    return <span className={cn("text-xs text-muted-foreground", className)}>No data for {label}</span>;
  }

  const isFlat = Math.round(percentChange) === 0;
  const isPositive = percentChange > 0;
  const Icon = isFlat ? Minus : isPositive ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        isFlat ? "text-muted-foreground" : isPositive ? "text-success" : "text-destructive",
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(percentChange).toFixed(0)}% {label}
    </span>
  );
}
