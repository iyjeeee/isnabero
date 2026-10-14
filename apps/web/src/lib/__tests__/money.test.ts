import { describe, expect, it } from "vitest";
import { formatAmount, formatPeso } from "../money";

describe("money formatting", () => {
  it("groups thousands and always shows two decimals", () => {
    expect(formatPeso(18713)).toBe("₱18,713.00");
    expect(formatPeso(693.0666)).toBe("₱693.07");
    expect(formatPeso(0)).toBe("₱0.00");
    expect(formatPeso(1234567.5)).toBe("₱1,234,567.50");
  });

  it("accepts numeric strings (database numerics) and has an amount-only form", () => {
    expect(formatPeso("799")).toBe("₱799.00");
    expect(formatAmount("1500")).toBe("1,500.00");
  });
});
