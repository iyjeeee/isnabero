import { describe, it, expect } from "vitest";
import { computePercentChange } from "../percent-change";

describe("computePercentChange", () => {
  it("computes a positive percent increase", () => {
    expect(computePercentChange(150, 100)).toBe(50);
  });

  it("computes a negative percent decrease", () => {
    expect(computePercentChange(50, 100)).toBe(-50);
  });

  it("returns 0 when both current and previous are 0 (flat, not undefined)", () => {
    expect(computePercentChange(0, 0)).toBe(0);
  });

  it("returns null when previous is 0 but current is not — no meaningful baseline to compare against", () => {
    expect(computePercentChange(500, 0)).toBeNull();
  });

  it("returns 0 when current equals previous", () => {
    expect(computePercentChange(200, 200)).toBe(0);
  });
});
