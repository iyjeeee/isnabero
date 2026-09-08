import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

// actionIconVariants: single source of truth for table row action buttons — a permanent tinted
// background (not just on hover) so Edit/Delete/View are visually distinguishable at a glance across
// every table in the app, instead of each feature inventing its own icon button styling.
const actionIconVariants = cva(
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      action: {
        edit: "bg-info/10 text-info hover:bg-info/20",
        delete: "bg-destructive/10 text-destructive hover:bg-destructive/20",
        view: "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      action: "view",
    },
  },
);

export interface ActionIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof actionIconVariants> {
  icon: React.ComponentType<{ className?: string }>;
}

export const ActionIconButton = React.forwardRef<HTMLButtonElement, ActionIconButtonProps>(
  ({ className, action, icon: Icon, ...props }, ref) => (
    <button ref={ref} type="button" className={cn(actionIconVariants({ action, className }))} {...props}>
      <Icon className="h-4 w-4" />
    </button>
  ),
);
ActionIconButton.displayName = "ActionIconButton";

export { actionIconVariants };
