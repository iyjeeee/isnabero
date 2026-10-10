import { Minus, Plus } from "lucide-react";
import { cn } from "../lib/utils";

export interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

// QuantityStepper: shared +/- quantity control for anywhere a line-item count is edited (POS cart today,
// future Inventory/Booking use) — use this instead of a raw number input so touch targets and keyboard
// entry behave identically everywhere.
export function QuantityStepper({ value, onChange, min = 0, max = 999, className }: QuantityStepperProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <div className={cn("flex items-center gap-1 rounded-md border bg-background p-0.5", className)}>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
        aria-label="Decrease quantity"
      >
        <Minus className="h-3 w-3" />
      </button>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(clamp(Number(event.target.value) || 0))}
        className="h-6 w-9 bg-transparent text-center text-sm font-medium tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label="Quantity"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
        aria-label="Increase quantity"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
