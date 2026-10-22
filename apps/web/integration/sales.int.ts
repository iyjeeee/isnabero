import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getContext, repos, tag, type TestContext } from "./harness";

let ctx: TestContext;
let r: ReturnType<typeof repos>;
let offering: Awaited<ReturnType<ReturnType<typeof repos>["catalog"]["createOfferingWithInclusions"]>>;
const stockOf = async () => (await r.inventory.listStockLevels(ctx.businessId)).find((level) => level.offeringId === offering.id)?.quantity;
const sell = (quantity: number, extra: Record<string, unknown> = {}) =>
  r.pos.checkout({ businessId: ctx.businessId, employeeId: ctx.ownerEmployeeId, lines: [{ offering, quantity }], method: "cash", ...extra });

beforeAll(async () => {
  ctx = await getContext();
  r = repos(ctx.owner.client);
  offering = await r.catalog.createOfferingWithInclusions(ctx.businessId, { offering: { name: tag("Stocked"), description: null, type: "item", price: "40.00", durationMinutes: null, isAvailable: true, barcode: null }, inclusions: [] });
  await r.inventory.startTracking(ctx.businessId, { offeringId: offering.id, quantity: 10, lowStockThreshold: 3, recordedBy: ctx.ownerEmployeeId });
});

afterAll(async () => {
  if (!r || !offering) return; // setup failed, nothing to clean
  await r.inventory.stopTracking(ctx.businessId, offering.id).catch(() => undefined);
  await r.catalog.toggleAvailability(offering.id, false).catch(() => undefined); // sold items cannot be deleted, so retire them
});

describe("inventory", () => {
  it("starts with the opening count and applies restock / damage adjustments", async () => {
    expect(await stockOf()).toBe(10);
    await r.inventory.adjustStock(ctx.businessId, { offeringId: offering.id, kind: "restock", delta: 5, note: "e2e restock", recordedBy: ctx.ownerEmployeeId });
    await r.inventory.adjustStock(ctx.businessId, { offeringId: offering.id, kind: "damage", delta: -2, note: "e2e damage", recordedBy: ctx.ownerEmployeeId });
    expect(await stockOf()).toBe(13);
    const moves = await r.inventory.listMovements(ctx.businessId, { offeringId: offering.id });
    expect(moves.map((move) => move.delta).sort((a, b) => a - b)).toEqual([-2, 5, 10]);
  });

  it("changes the low-stock threshold and reports the status", async () => {
    await r.inventory.setLowStockThreshold(ctx.businessId, offering.id, 20);
    expect((await r.inventory.listStockLevels(ctx.businessId)).find((level) => level.offeringId === offering.id)?.status).toBe("low");
    await r.inventory.setLowStockThreshold(ctx.businessId, offering.id, 3);
  });
});

describe("POS checkout", () => {
  it("records a sale, takes the stock, and the receipt shows the lines and business details", async () => {
    const before = await stockOf();
    const result = await sell(2, { referenceCode: "E2E-REF" });
    expect(result.total).toBe(80);
    expect(result.receiptNumber).toBeGreaterThan(0);
    expect(await stockOf()).toBe(before! - 2);
    const receipt = await r.pos.getReceipt(ctx.businessId, { orderId: result.orderId });
    expect(receipt?.total).toBe(80);
    expect(receipt?.lines[0]).toMatchObject({ quantity: 2 });
    expect(receipt?.business.name).toBe("E2E Test Business");
    expect(receipt?.voided).toBe(false);
  });

  it("is idempotent: the same clientId sent twice is one sale and one stock deduction", async () => {
    const clientId = randomUUID();
    const before = await stockOf();
    const first = await sell(1, { clientId });
    const second = await sell(1, { clientId });
    expect(first.duplicate).toBeFalsy();
    expect(second.duplicate).toBe(true);
    expect(second.orderId).toBe(first.orderId);
    expect(await stockOf()).toBe(before! - 1);
  });

  it("backdates an offline sale but never into the future", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000);
    const past = await sell(1, { clientId: randomUUID(), soldAt: twoHoursAgo });
    const future = await sell(1, { clientId: randomUUID(), soldAt: new Date(Date.now() + 5 * 86400_000) });
    const records = await r.core.listPaymentRecords(ctx.businessId, { includeVoided: true });
    const when = async (orderId: string) => {
      const receipt = await r.pos.getReceipt(ctx.businessId, { orderId });
      return receipt!.issuedAt.getTime();
    };
    expect(Math.abs((await when(past.orderId)) - twoHoursAgo.getTime())).toBeLessThan(60_000);
    expect(await when(future.orderId)).toBeLessThanOrEqual(Date.now() + 60_000);
    expect(records.length).toBeGreaterThan(0);
  });

  it("refuses to sell more than the stock and leaves everything unchanged", async () => {
    const before = await stockOf();
    await expect(sell(before! + 50)).rejects.toThrow(/stock|enough|left/i);
    expect(await stockOf()).toBe(before);
  });
});

describe("payments, dashboard and voiding", () => {
  it("lists the sale, counts it today, and a void puts the stock back", async () => {
    const stats = await r.core.getDashboardStats(ctx.businessId);
    const before = await stockOf();
    const sale = await sell(3);
    const after = await r.core.getDashboardStats(ctx.businessId);
    expect(after.todaySalesTotal - stats.todaySalesTotal).toBeCloseTo(120, 2);
    expect(await stockOf()).toBe(before! - 3);

    const records = await r.core.listPaymentRecords(ctx.businessId);
    const record = records.find((row) => row.receiptNumber === sale.receiptNumber);
    expect(record).toMatchObject({ amount: 120, method: "cash", sourceModule: "pos" });
    expect(record!.summary).toContain("3");

    await r.core.voidPaymentRecord(ctx.businessId, record!.id);
    expect(await stockOf()).toBe(before);
    const receipt = await r.pos.getReceipt(ctx.businessId, { orderId: sale.orderId });
    expect(receipt?.voided).toBe(true);
    expect((await r.core.listPaymentRecords(ctx.businessId)).some((row) => row.id === record!.id)).toBe(false); // hidden by default
    const all = await r.core.listPaymentRecords(ctx.businessId, { includeVoided: true });
    expect(all.find((row) => row.id === record!.id)?.voidedAt).not.toBeNull();
  });
});
