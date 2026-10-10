import { describe, expect, it } from "vitest";
import type { Expense } from "@isnabero/module-expenses";
import { computeExpenseStats } from "../expense-stats";

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: "x",
    businessId: "b",
    category: "other",
    description: "d",
    amount: 100,
    expenseDate: "2026-10-05",
    method: "cash",
    notes: null,
    recordedBy: null,
    voidedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("computeExpenseStats", () => {
  it("sums this month and all time, ignoring voided expenses", () => {
    const stats = computeExpenseStats(
      [
        expense({ amount: 100.1 }),
        expense({ amount: 200.2, expenseDate: "2026-09-30" }),
        expense({ amount: 999, voidedAt: new Date() }),
      ],
      "2026-10-08",
    );
    expect(stats.monthTotal).toBe(100.1);
    expect(stats.allTimeTotal).toBe(300.3);
  });

  it("picks the biggest category of the current month", () => {
    const stats = computeExpenseStats(
      [expense({ category: "rent", amount: 500 }), expense({ category: "supplies", amount: 50 }), expense({ category: "supplies", amount: 60 }), expense({ category: "salaries", amount: 9000, expenseDate: "2026-09-01" })],
      "2026-10-08",
    );
    expect(stats.topCategory).toEqual({ category: "rent", total: 500 });
  });

  it("has no top category and zero totals when empty", () => {
    expect(computeExpenseStats([], "2026-10-08")).toEqual({ monthTotal: 0, allTimeTotal: 0, topCategory: null });
  });
});
