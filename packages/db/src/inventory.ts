// Shared inventory rules (browser-safe; used by the mock and Supabase repositories and the UI).
export const STOCK_KINDS = ["initial", "restock", "correction", "damage", "return", "sale"] as const;
export type StockKind = (typeof STOCK_KINDS)[number];

// MANUAL_STOCK_KINDS: what a person can pick when adjusting ("sale" and "initial" are written by the system)
export const MANUAL_STOCK_KINDS = [
  { value: "restock", label: "Restock (received more)", sign: 1 },
  { value: "return", label: "Customer return", sign: 1 },
  { value: "correction", label: "Correction (recount)", sign: 0 }, // either direction
  { value: "damage", label: "Damaged / spoiled / lost", sign: -1 },
] as const;

export const MAX_STOCK_QUANTITY = 1_000_000;

export type StockStatus = "ok" | "low" | "out";

// stockStatus: out at 0, low at or below the threshold (when a threshold is set), otherwise ok
export function stockStatus(quantity: number, lowStockThreshold: number): StockStatus {
  if (quantity <= 0) return "out";
  if (lowStockThreshold > 0 && quantity <= lowStockThreshold) return "low";
  return "ok";
}

// InsufficientStockError: thrown when a sale or adjustment would take a tracked item below zero
export class InsufficientStockError extends Error {
  constructor(
    public readonly offeringName: string,
    public readonly available: number,
  ) {
    super(
      available <= 0
        ? `"${offeringName}" is out of stock.`
        : `Not enough "${offeringName}" in stock — only ${available} left.`,
    );
    this.name = "InsufficientStockError";
  }
}
