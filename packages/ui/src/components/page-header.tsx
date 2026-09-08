import * as React from "react";
import { cn } from "../lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  // icon: optional module-matching icon chip — pass the same icon used in the sidebar for that
  // page/module so the header visually ties back to the nav item that led here.
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}

// PageHeader: every page (Dashboard, Catalog, POS, etc.) renders its title/description/action through
// this component instead of hand-rolled <h1>/<p> markup. Rendered as a proper bordered/shadowed banner
// section (not bare floating text) so every page reads as a designed screen from the first fold.
export function PageHeader({ title, description, icon: Icon, action, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-card sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        {Icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
