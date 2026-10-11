import { describe, expect, it } from "vitest";
import { adjustSchema, computeDelta, trackItemSchema } from "../inventory-form-schema";

describe("trackItemSchema", () => {
  const base = { offeringId: "x", quantity: "10", lowStockThreshold: "3" };
  it("accepts whole numbers including 0", () => {
    expect(trackItemSchema.safeParse(base).success).toBe(true);
    expect(trackItemSchema.safeParse({ ...base, quantity: "0", lowStockThreshold: "0" }).success).toBe(true);
  });
  it("rejects blanks (not treated as 0), decimals, negatives and no item", () => {
    for (const bad of [{ quantity: "" }, { quantity: "1.5" }, { quantity: "-1" }, { lowStockThreshold: "" }, { offeringId: "" }]) {
      expect(trackItemSchema.safeParse({ ...base, ...bad }).success).toBe(false);
    }
  });
});

describe("adjustSchema", () => {
  const base = { kind: "restock", quantity: "5", note: "Delivery" };
  it("requires a note and a whole quantity", () => {
    expect(adjustSchema.safeParse(base).success).toBe(true);
    expect(adjustSchema.safeParse({ ...base, note: "  " }).success).toBe(false);
    expect(adjustSchema.safeParse({ ...base, quantity: "" }).success).toBe(false);
    expect(adjustSchema.safeParse({ ...base, quantity: "2.5" }).success).toBe(false);
  });
  it("allows 0 only for a correction (a recount can find none left)", () => {
    expect(adjustSchema.safeParse({ ...base, quantity: "0" }).success).toBe(false);
    expect(adjustSchema.safeParse({ ...base, kind: "damage", quantity: "0" }).success).toBe(false);
    expect(adjustSchema.safeParse({ ...base, kind: "correction", quantity: "0" }).success).toBe(true);
  });
});

describe("computeDelta", () => {
  it("adds for restock/return, subtracts for damage, and diffs a correction against the current count", () => {
    expect(computeDelta("restock", 5, 10)).toBe(5);
    expect(computeDelta("return", 1, 10)).toBe(1);
    expect(computeDelta("damage", 3, 10)).toBe(-3);
    expect(computeDelta("correction", 7, 10)).toBe(-3);
    expect(computeDelta("correction", 12, 10)).toBe(2);
    expect(computeDelta("correction", 0, 4)).toBe(-4);
  });
});
