import { beforeAll, describe, expect, it } from "vitest";
import { getContext, repos, tag, type TestContext } from "./harness";

let ctx: TestContext;
let r: ReturnType<typeof repos>;
const today = () => new Date().toISOString().slice(0, 10);
const input = (amount: number, extra: Record<string, unknown> = {}) => ({ category: "supplies" as const, description: tag("Expense"), amount, expenseDate: today(), method: "cash" as const, notes: null, recordedBy: null as string | null, ...extra });

beforeAll(async () => {
  ctx = await getContext();
  r = repos(ctx.owner.client);
});

describe("expenses", () => {
  it("creates, lists, corrects and voids an expense (voiding twice is harmless)", async () => {
    const made = await r.expenses.createExpense(ctx.businessId, input(120.5, { recordedBy: ctx.ownerEmployeeId }));
    expect(made.amount).toBe(120.5);
    expect(made.recordedBy).toBe(ctx.ownerEmployeeId);
    const fixed = await r.expenses.updateExpense(ctx.businessId, made.id, input(99, { description: made.description, category: "utilities" }));
    expect(fixed).toMatchObject({ amount: 99, category: "utilities" });
    await r.expenses.voidExpense(ctx.businessId, made.id);
    await r.expenses.voidExpense(ctx.businessId, made.id);
    expect((await r.expenses.listExpenses(ctx.businessId)).some((row) => row.id === made.id)).toBe(false);
    const voided = (await r.expenses.listExpenses(ctx.businessId, { includeVoided: true })).find((row) => row.id === made.id);
    expect(voided?.voidedAt).not.toBeNull();
    await expect(r.expenses.updateExpense(ctx.businessId, made.id, input(5))).rejects.toThrow();
  });

  it("rejects bad input: zero amount, future date, blank description", async () => {
    await expect(r.expenses.createExpense(ctx.businessId, input(0))).rejects.toThrow();
    await expect(r.expenses.createExpense(ctx.businessId, input(10, { expenseDate: "2999-01-01" }))).rejects.toThrow();
    await expect(r.expenses.createExpense(ctx.businessId, input(10, { description: "   " }))).rejects.toThrow();
  });
});

describe("cash close", () => {
  it("expected = float + cash sales − cash expenses, the difference is counted − expected, and the next close starts where this ended", async () => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const offering = await r.catalog.createOfferingWithInclusions(ctx.businessId, { offering: { name: tag("Drawer"), description: null, type: "item", price: "100.00", durationMinutes: null, isAvailable: true, barcode: null }, inclusions: [] });
    const before = await r.core.getCashCloseSummary(ctx.businessId, dayStart);
    await r.pos.checkout({ businessId: ctx.businessId, employeeId: ctx.ownerEmployeeId, lines: [{ offering, quantity: 2 }], method: "cash" });
    await r.pos.checkout({ businessId: ctx.businessId, employeeId: ctx.ownerEmployeeId, lines: [{ offering, quantity: 1 }], method: "gcash", referenceCode: "E2E-G" }); // not cash
    await r.expenses.createExpense(ctx.businessId, input(50, { recordedBy: ctx.ownerEmployeeId }));
    const summary = await r.core.getCashCloseSummary(ctx.businessId, dayStart);
    expect(summary.cashSales - before.cashSales).toBeCloseTo(200, 2);
    expect(summary.cashExpenses - before.cashExpenses).toBeCloseTo(50, 2);

    const expected = 1000 + summary.cashSales - summary.cashExpenses;
    const close = await r.core.closeCash(ctx.businessId, dayStart, { openingFloat: 1000, counted: expected - 25, note: tag("close") });
    expect(close.expected).toBeCloseTo(expected, 2);
    expect(close.difference).toBeCloseTo(-25, 2);
    expect((await r.core.listCashCloses(ctx.businessId))[0]?.id).toBe(close.id);

    const next = await r.core.getCashCloseSummary(ctx.businessId, dayStart);
    expect(next.periodStart.getTime()).toBeGreaterThanOrEqual(close.periodEnd.getTime() - 1000);
    expect(next.cashSales).toBe(0);
    expect(next.lastCounted).toBeCloseTo(expected - 25, 2);
    await r.catalog.toggleAvailability(offering.id, false);
  });

  it("refuses negative amounts", async () => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    await expect(r.core.closeCash(ctx.businessId, dayStart, { openingFloat: -1, counted: 0 })).rejects.toThrow();
  });
});
