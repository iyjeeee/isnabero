import * as React from "react";
import { cn } from "../lib/utils";

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {}

// FilterBar: wraps search inputs, filter tabs, and dropdowns in one visually distinct, bordered bar —
// so "controls that narrow down the list below" are always grouped and easy to spot, instead of floating
// loose above a table/grid. Compose freely: <FilterBar><SearchInput/><FilterTabs/></FilterBar>.
export function FilterBar({ className, ...props }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    />
  );
}
