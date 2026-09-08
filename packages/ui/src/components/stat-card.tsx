import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Card, CardContent } from "./card";
import { cn } from "../lib/utils";

// statCardVariants: the icon badge's color per semantic meaning — pass `accent` to match the stat's
// nature (money = success, time-based = info, people = default) instead of hardcoding colors per usage.
const statIconVariants = cva("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", {
  variants: {
    accent: {
      default: "bg-primary/10 text-primary",
      success: "bg-success/10 text-success",
      info: "bg-info/10 text-info",
      warning: "bg-warning/10 text-warning",
    },
  },
  defaultVariants: { accent: "default" },
});

export interface StatCardProps extends VariantProps<typeof statIconVariants> {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, accent, isLoading, className }: StatCardProps) {
  return (
    <Card interactive className={cn(className)}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn(statIconVariants({ accent }))}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          {isLoading ? (
            <div className="mt-1.5 h-7 w-20 animate-pulse rounded-md bg-muted" />
          ) : (
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
