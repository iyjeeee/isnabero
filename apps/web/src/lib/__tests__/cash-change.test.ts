import { describe, expect, it } from "vitest";
import { changeDue, quickTenders } from "../cash-change";

describe("changeDue", () => {
  it("is null until an amount is typed", () => expect(changeDue(150, Number.NaN)).toBeNull());
  it("is the money to hand back, to the centavo", () => {
    expect(changeDue(149.9, 200)).toBe(50.1);
    expect(changeDue(150, 150)).toBe(0);
  });
  it("is negative when short", () => expect(changeDue(150, 100)).toBe(-50));
});

describe("quickTenders", () => {
  it("offers the exact peso amount first and never less than the total", () => {
    const options = quickTenders(137.5);
    expect(options[0]).toBe(138);
    expect(options.every((amount) => amount >= 137.5)).toBe(true);
    expect(options.length).toBeLessThanOrEqual(4);
  });
  it("has no duplicates", () => expect(new Set(quickTenders(100)).size).toBe(quickTenders(100).length));
});
