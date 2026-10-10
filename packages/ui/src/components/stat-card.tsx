import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Card, CardContent } from "./card";
import { cn } from "../lib/utils";

// statCardVariants: the icon badge's color per semantic meaning — pass `accent` to match the stat's
// nature (money = success, time-based = info, people = default) instead of hardcoding colors per usage.
// Each tile carries a soft diagonal gradient wash (rather than a flat tint) so the stat row reads as
// designed rather than a bare list of numbers — still fully token-driven, no hardcoded colors.
const statIconVariants = cva(
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ring-1 transition-transform duration-200 group-hover:scale-105",
  {
    variants: {
      accent: {
        default: "from-primary/20 via-primary/10 to-transparent text-primary ring-primary/15",
        success: "from-success/20 via-success/10 to-transparent text-success ring-success/15",
        info: "from-info/20 via-info/10 to-transparent text-info ring-info/15",
        warning: "from-warning/20 via-warning/10 to-transparent text-warning ring-warning/15",
      },
    },
    defaultVariants: { accent: "default" },
  },
);

export interface StatCardProps extends VariantProps<typeof statIconVariants> {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
  // helpText: optional small secondary line under the value (e.g. "vs ₱1,200 yesterday") — kept generic
  // text rather than a trend-specific prop so any page can use it for any short annotation.
  helpText?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, accent, isLoading, helpText, className }: StatCardProps) {
  return (
    <Card interactive className={cn("group overflow-hidden", className)}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn(statIconVariants({ accent }))}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {isLoading ? (
            <div className="mt-1.5 h-7 w-20 animate-pulse rounded-md bg-muted" />
          ) : (
            <p className="truncate font-display text-2xl font-bold tracking-tight">{value}</p>
          )}
          {!isLoading && helpText && <p className="mt-0.5 truncate text-xs text-muted-foreground">{helpText}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
