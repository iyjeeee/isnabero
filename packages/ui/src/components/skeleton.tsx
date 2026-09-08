import * as React from "react";
import { cn } from "../lib/utils";

// Skeleton: a single pulsing placeholder block — compose multiple to build a loading version of any
// layout (table rows, cards, text lines) instead of showing a bare "Loading…" string.
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}
