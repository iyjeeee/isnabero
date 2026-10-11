import type { StockKind, StockStatus } from "@isnabero/db";

// StockLevel: a tracked offering with its current count
export interface StockLevel {
  offeringId: string;
  offeringName: string;
  offeringType: string; // item | bundle | addon
  quantity: number;
  lowStockThreshold: number;
  status: StockStatus;
}

// StockMovementView: one ledger line, joined with the offering and the employee who made it
export interface StockMovementView {
  id: string;
  offeringId: string;
  offeringName: string;
  delta: number;
  kind: StockKind;
  note: string | null;
  recordedByName: string | null; // null = system (e.g. a sale) or a removed employee
  createdAt: Date;
}

export interface StartTrackingInput {
  offeringId: string;
  quantity: number; // opening count (0 allowed)
  lowStockThreshold: number;
  recordedBy: string | null;
}

export interface AdjustStockInput {
  offeringId: string;
  kind: "restock" | "return" | "correction" | "damage";
  delta: number; // signed whole number: restock/return positive, damage negative, correction either (never 0)
  note: string; // required: why
  recordedBy: string | null;
}

export interface ListMovementsOptions {
  offeringId?: string;
  limit?: number; // newest first; default 200
}
