import { describe, expect, it } from "vitest";
import { todayYmd } from "@isnabero/module-expenses";
import { expenseFormSchema } from "../expense-form-schema";

const base = { expenseDate: todayYmd(), category: "rent", description: "March rent", amount: "8000", method: "cash", notes: "" };

describe("expenseFormSchema", () => {
  it("accepts a valid expense", () => {
    expect(expenseFormSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a blank amount instead of treating it as 0", () => {
    expect(expenseFormSchema.safeParse({ ...base, amount: "" }).success).toBe(false);
    expect(expenseFormSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(expenseFormSchema.safeParse({ ...base, amount: "-3" }).success).toBe(false);
    expect(expenseFormSchema.safeParse({ ...base, amount: "abc" }).success).toBe(false);
  });

  it("rejects a future or missing date", () => {
    expect(expenseFormSchema.safeParse({ ...base, expenseDate: "2999-01-01" }).success).toBe(false);
    expect(expenseFormSchema.safeParse({ ...base, expenseDate: "" }).success).toBe(false);
  });

  it("rejects a blank description and an unknown category", () => {
    expect(expenseFormSchema.safeParse({ ...base, description: "   " }).success).toBe(false);
    expect(expenseFormSchema.safeParse({ ...base, category: "bogus" }).success).toBe(false);
  });
});
