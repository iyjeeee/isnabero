import { MAX_STOCK_QUANTITY } from "@isnabero/db";
import type { AdjustStockInput, StartTrackingInput } from "./types";

export const MAX_NOTE_LENGTH = 200;

function assertWholeNumber(value: number, label: string, min: number): void {
  if (!Number.isInteger(value)) throw new Error(`${label} must be a whole number.`);
  if (value < min) throw new Error(`${label} can't be less than ${min}.`);
  if (value > MAX_STOCK_QUANTITY) throw new Error(`${label} is too large.`);
}

// normalizeTracking: shared by both repositories — whole, non-negative counts
export function normalizeTracking(input: StartTrackingInput): StartTrackingInput {
  assertWholeNumber(input.quantity, "Starting quantity", 0);
  assertWholeNumber(input.lowStockThreshold, "Low-stock level", 0);
  return input;
}

export function normalizeThreshold(value: number): number {
  assertWholeNumber(value, "Low-stock level", 0);
  return value;
}

// normalizeAdjustment: a note is always required, and the kind decides which direction is allowed
export function normalizeAdjustment(input: AdjustStockInput): AdjustStockInput {
  const note = input.note.trim();
  if (!note) throw new Error("Add a short reason for this adjustment.");
  if (note.length > MAX_NOTE_LENGTH) throw new Error(`The reason must be ${MAX_NOTE_LENGTH} characters or fewer.`);
  if (!Number.isInteger(input.delta) || input.delta === 0) throw new Error("Enter a whole number other than 0.");
  if (Math.abs(input.delta) > MAX_STOCK_QUANTITY) throw new Error("That quantity is too large.");
  if ((input.kind === "restock" || input.kind === "return") && input.delta < 0) throw new Error("A restock or return must add stock.");
  if (input.kind === "damage" && input.delta > 0) throw new Error("Damaged or lost stock must remove stock.");
  return { ...input, note };
}

export function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}
