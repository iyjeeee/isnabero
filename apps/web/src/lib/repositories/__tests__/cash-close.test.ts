import { describe, expect, it } from "vitest";
import { mockCoreRepository } from "../mock-repository";
import { expectedCash } from "../repository";
import { mockDb, genId, cashCloseRows, auditRows } from "@isnabero/db";

const B = "00000000-0000-0000-0000-0000000000cc";
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);
const dayStart = hoursAgo(10);

// pay: a payment record (cash by default) at a time in the test business
function pay(amount: number, createdAt: Date, extra: Partial<(typeof mockDb.paymentRecords)[number]> = {}) {
  mockDb.paymentRecords.push({ id: genId(), businessId: B, sourceModule: "pos", method: "cash", referenceCode: null, amount: amount.toFixed(2), createdAt, voidedAt: null, ...extra });
}
function spend(amount: number, createdAt: Date, method: "cash" | "gcash" = "cash") {
  mockDb.expenses.push({ id: genId(), businessId: B, category: "supplies", description: "Test", amount: amount.toFixed(2), expenseDate: "2026-01-01", method, notes: null, recordedBy: null, voidedAt: null, createdAt });
}

describe("expectedCash", () => {
  it("is starting cash plus sales minus payouts, to the centavo", () => {
    expect(expectedCash(500, 300.1, 50.05)).toBe(750.05);
  });
});

describe("cash close (mock)", () => {
  it("counts only cash, skips voided records, and the next close starts where the last ended", async () => {
    pay(300, hoursAgo(5));
    pay(999, hoursAgo(5), { method: "gcash" });
    pay(111, hoursAgo(5), { voidedAt: new Date() });
    pay(50, hoursAgo(20)); // before today started
    spend(40, hoursAgo(4));
    spend(77, hoursAgo(4), "gcash");

    const before = await mockCoreRepository.getCashCloseSummary(B, dayStart);
    expect(before).toMatchObject({ cashSales: 300, cashExpenses: 40, lastCounted: null });

    const first = await mockCoreRepository.closeCash(B, dayStart, { openingFloat: 500, counted: 750, note: "  ok " });
    expect(first).toMatchObject({ expected: 760, counted: 750, difference: -10, openingFloat: 500, note: "ok" });
    expect(auditRows.some((row) => row.action === "cash.closed" && row.summary === "Cash closed: counted ₱750.00 vs expected ₱760.00 (short ₱10.00)")).toBe(true);

    const after = await mockCoreRepository.getCashCloseSummary(B, dayStart);
    expect(after).toMatchObject({ cashSales: 0, cashExpenses: 0, lastCounted: 750 });
    expect(after.periodStart.getTime()).toBe(first.periodEnd.getTime());
    expect(cashCloseRows.filter((row) => row.businessId === B)).toHaveLength(1);
    expect((await mockCoreRepository.listCashCloses(B))[0]?.id).toBe(first.id);
  });

  it("rejects negative or missing amounts", async () => {
    await expect(mockCoreRepository.closeCash(B, dayStart, { openingFloat: -1, counted: 10 })).rejects.toThrow(/zero or more/);
    await expect(mockCoreRepository.closeCash(B, dayStart, { openingFloat: 0, counted: Number.NaN })).rejects.toThrow(/zero or more/);
  });
});
