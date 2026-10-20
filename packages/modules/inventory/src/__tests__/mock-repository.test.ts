import { describe, it, expect } from "vitest";
import { mockDb, genId, DEMO_BUSINESS_ID, InsufficientStockError, auditRows, stockStatus } from "@isnabero/db";
import { mockInventoryRepository as repo } from "../mock-repository";

const OTHER_BUSINESS_ID = "00000000-0000-0000-0000-00000000ffff";

// Fresh offering per test so tests can't affect each other or the seeded stock
function newOffering(name: string) {
  const offering = { id: genId(), businessId: DEMO_BUSINESS_ID, name, description: null, type: "item" as const, price: "10.00", durationMinutes: null, isAvailable: true, createdAt: new Date(), barcode: null };
  mockDb.offerings.push(offering);
  return offering;
}
const track = (offeringId: string, quantity = 10, lowStockThreshold = 3) => repo.startTracking(DEMO_BUSINESS_ID, { offeringId, quantity, lowStockThreshold, recordedBy: null });
const level = async (offeringId: string) => (await repo.listStockLevels(DEMO_BUSINESS_ID)).find((item) => item.offeringId === offeringId);
const adjust = (offeringId: string, kind: "restock" | "return" | "correction" | "damage", delta: number, note = "test") =>
  repo.adjustStock(DEMO_BUSINESS_ID, { offeringId, kind, delta, note, recordedBy: null });

describe("stock tracking", () => {
  it("starts tracking with an opening count recorded as an initial movement", async () => {
    const offering = newOffering("Track A");
    await track(offering.id, 12, 4);
    expect(await level(offering.id)).toMatchObject({ quantity: 12, lowStockThreshold: 4, status: "ok", offeringName: "Track A" });
    const moves = await repo.listMovements(DEMO_BUSINESS_ID, { offeringId: offering.id });
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ delta: 12, kind: "initial" });
  });

  it("allows an opening count of 0 (no movement) and rejects bad numbers, duplicates and foreign offerings", async () => {
    const offering = newOffering("Track B");
    await track(offering.id, 0, 0);
    expect((await repo.listMovements(DEMO_BUSINESS_ID, { offeringId: offering.id }))).toHaveLength(0);
    await expect(track(offering.id)).rejects.toThrow(/already tracked/);
    const other = newOffering("Track C");
    await expect(track(other.id, -1)).rejects.toThrow(/can't be less than 0/);
    await expect(track(other.id, 1.5)).rejects.toThrow(/whole number/);
    await expect(repo.startTracking(OTHER_BUSINESS_ID, { offeringId: other.id, quantity: 1, lowStockThreshold: 0, recordedBy: null })).rejects.toThrow(/not found/);
    expect(await level(other.id)).toBeUndefined();
  });

  it("stopTracking removes the item from levels but keeps its history", async () => {
    const offering = newOffering("Track D");
    await track(offering.id, 5);
    await repo.stopTracking(DEMO_BUSINESS_ID, offering.id);
    expect(await level(offering.id)).toBeUndefined();
    expect((await repo.listMovements(DEMO_BUSINESS_ID, { offeringId: offering.id })).length).toBe(1);
    await expect(repo.stopTracking(DEMO_BUSINESS_ID, offering.id)).rejects.toThrow(/isn't tracked/);
  });

  it("derives status: out at 0, low at or below the threshold, else ok", () => {
    expect(stockStatus(0, 5)).toBe("out");
    expect(stockStatus(5, 5)).toBe("low");
    expect(stockStatus(6, 5)).toBe("ok");
    expect(stockStatus(1, 0)).toBe("ok"); // no threshold set = never "low"
  });
});

describe("adjustments", () => {
  it("restock adds, damage removes, and each leaves a movement with its note", async () => {
    const offering = newOffering("Adj A");
    await track(offering.id, 10);
    await adjust(offering.id, "restock", 5, "Delivery");
    await adjust(offering.id, "damage", -3, "Spoiled");
    expect((await level(offering.id))?.quantity).toBe(12);
    const moves = await repo.listMovements(DEMO_BUSINESS_ID, { offeringId: offering.id });
    expect(moves.map((move) => [move.kind, move.delta, move.note]).sort()).toEqual([["damage", -3, "Spoiled"], ["initial", 10, "Opening count"], ["restock", 5, "Delivery"]]);
  });

  it("never goes below zero: rejects with InsufficientStockError and records nothing", async () => {
    const offering = newOffering("Adj B");
    await track(offering.id, 2);
    const before = mockDb.stockMovements.length;
    await expect(adjust(offering.id, "damage", -3)).rejects.toBeInstanceOf(InsufficientStockError);
    await expect(adjust(offering.id, "correction", -3)).rejects.toThrow(/only 2 left/);
    expect(mockDb.stockMovements.length).toBe(before);
    expect((await level(offering.id))?.quantity).toBe(2);
  });

  it("enforces direction per kind, a required note, and whole non-zero numbers", async () => {
    const offering = newOffering("Adj C");
    await track(offering.id, 5);
    await expect(adjust(offering.id, "restock", -1)).rejects.toThrow(/must add stock/);
    await expect(adjust(offering.id, "return", -1)).rejects.toThrow(/must add stock/);
    await expect(adjust(offering.id, "damage", 1)).rejects.toThrow(/must remove stock/);
    await expect(adjust(offering.id, "correction", 0)).rejects.toThrow(/other than 0/);
    await expect(adjust(offering.id, "correction", 1.5)).rejects.toThrow(/whole number/);
    await expect(adjust(offering.id, "restock", 1, "   ")).rejects.toThrow(/reason/);
    await adjust(offering.id, "correction", -2, "Recount");
    expect((await level(offering.id))?.quantity).toBe(3);
  });

  it("rejects adjusting an untracked offering", async () => {
    const offering = newOffering("Adj D");
    await expect(adjust(offering.id, "restock", 1)).rejects.toThrow(/isn't tracked/);
  });

  it("changing the low-stock level updates the status; setting the same value logs nothing", async () => {
    const offering = newOffering("Adj E");
    await track(offering.id, 4, 0);
    expect((await level(offering.id))?.status).toBe("ok");
    await repo.setLowStockThreshold(DEMO_BUSINESS_ID, offering.id, 5);
    expect((await level(offering.id))?.status).toBe("low");
    const before = auditRows.length;
    await repo.setLowStockThreshold(DEMO_BUSINESS_ID, offering.id, 5);
    expect(auditRows.length).toBe(before);
  });
});

describe("history and audit", () => {
  it("lists movements newest first, scoped to the business", async () => {
    const moves = await repo.listMovements(DEMO_BUSINESS_ID);
    for (let i = 1; i < moves.length; i++) expect(moves[i - 1]!.createdAt.getTime() >= moves[i]!.createdAt.getTime()).toBe(true);
    expect(await repo.listMovements(OTHER_BUSINESS_ID)).toEqual([]);
    expect((await repo.listMovements(DEMO_BUSINESS_ID, { limit: 1 })).length).toBe(1);
  });

  it("writes audit entries for tracking and adjustments", async () => {
    const offering = newOffering("Aud A");
    await track(offering.id, 3);
    await adjust(offering.id, "restock", 2, "Delivery");
    const rows = auditRows.filter((row) => row.entityId === offering.id);
    expect(rows.map((row) => row.action)).toEqual(["stock.tracking_changed", "stock.adjusted"]);
    expect(rows[1]?.summary).toBe('Adjusted "Aud A" +2 (restock): Delivery');
  });
});

describe("seeded demo stock", () => {
  it("has one healthy, one low and one out-of-stock item", async () => {
    const statuses = (await repo.listStockLevels(DEMO_BUSINESS_ID)).filter((item) => ["Sisig", "Lumpia (6 pcs)", "Halo-Halo"].includes(item.offeringName)).map((item) => item.status).sort();
    expect(statuses).toEqual(["low", "ok", "out"]);
  });
});
