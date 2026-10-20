import { describe, expect, it } from "vitest";
import { buildProfitReport } from "../profit";

const day = (value: string) => new Date(`${value}T12:00:00`);
const payments = [
  { amount: "1000", createdAt: day("2026-06-10"), voidedAt: null },
  { amount: "500", createdAt: day("2026-06-11"), voidedAt: new Date() }, // voided: ignored
  { amount: "400", createdAt: day("2026-06-02"), voidedAt: null }, // previous window
];
const expenses = [
  { amount: "300", expenseDate: "2026-06-10", category: "rent", voidedAt: null },
  { amount: "100", expenseDate: "2026-06-11", category: "supplies", voidedAt: null },
  { amount: "999", expenseDate: "2026-06-11", category: "other", voidedAt: new Date() }, // voided: ignored
  { amount: "50", expenseDate: "2026-06-02", category: "rent", voidedAt: null }, // previous window
];

describe("buildProfitReport", () => {
  const report = buildProfitReport(payments, expenses, { start: day("2026-06-08"), end: null }, { start: day("2026-06-01"), end: day("2026-06-08") });
  it("subtracts active expenses from active revenue", () => {
    expect(report).toMatchObject({ revenue: 1000, expenses: 400, profit: 600 });
  });
  it("compares with the window before", () => expect(report.previousProfit).toBe(350));
  it("lists expense categories biggest first", () => expect(report.expensesByCategory).toEqual([{ label: "rent", value: 300 }, { label: "supplies", value: 100 }]));
});
