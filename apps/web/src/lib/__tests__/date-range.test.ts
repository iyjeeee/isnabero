import { describe, expect, it } from "vitest";
import { inDateRange, toLocalYmd, validateDateRange } from "../date-range";

describe("date-range", () => {
  it("formats the local calendar day with zero padding", () => {
    expect(toLocalYmd(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("treats both bounds as inclusive and each as optional", () => {
    expect(inDateRange("2026-03-10", { from: "2026-03-10", to: "2026-03-10" })).toBe(true);
    expect(inDateRange("2026-03-09", { from: "2026-03-10" })).toBe(false);
    expect(inDateRange("2026-03-11", { to: "2026-03-10" })).toBe(false);
    expect(inDateRange("1999-01-01", {})).toBe(true);
    expect(inDateRange("2026-03-10", { from: "", to: "" })).toBe(true);
  });

  it("flags a reversed range only", () => {
    expect(validateDateRange({ from: "2026-03-11", to: "2026-03-10" })).toMatch(/can't be after/);
    expect(validateDateRange({ from: "2026-03-10", to: "2026-03-10" })).toBeNull();
    expect(validateDateRange({ from: "2026-03-10" })).toBeNull();
  });
});
