import { mockDb, delay, recordAudit, stockStatus, applyStockMove } from "@isnabero/db";
import type { InventoryRepository } from "./repository";
import type { StockLevel, StockMovementView } from "./types";
import { formatDelta, normalizeAdjustment, normalizeThreshold, normalizeTracking } from "./validation";

function offeringOf(offeringId: string) {
  return mockDb.offerings.find((offering) => offering.id === offeringId);
}

function toLevel(row: (typeof mockDb.stockItems)[number]): StockLevel {
  const offering = offeringOf(row.offeringId);
  return {
    offeringId: row.offeringId,
    offeringName: offering?.name ?? "Unknown offering",
    offeringType: offering?.type ?? "item",
    quantity: row.quantity,
    lowStockThreshold: row.lowStockThreshold,
    status: stockStatus(row.quantity, row.lowStockThreshold),
  };
}

function requireTracked(businessId: string, offeringId: string) {
  const row = mockDb.stockItems.find((item) => item.offeringId === offeringId && item.businessId === businessId);
  if (!row) throw new Error("This item isn't tracked in inventory.");
  return row;
}

export const mockInventoryRepository: InventoryRepository = {
  async listStockLevels(businessId) {
    await delay();
    return mockDb.stockItems
      .filter((row) => row.businessId === businessId)
      .map(toLevel)
      .sort((a, b) => a.offeringName.localeCompare(b.offeringName));
  },

  async listMovements(businessId, options) {
    await delay();
    return mockDb.stockMovements
      .filter((row) => row.businessId === businessId && (!options?.offeringId || row.offeringId === options.offeringId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, options?.limit ?? 200)
      .map((row): StockMovementView => ({
        id: row.id,
        offeringId: row.offeringId,
        offeringName: offeringOf(row.offeringId)?.name ?? "Unknown offering",
        delta: row.delta,
        kind: row.kind,
        note: row.note,
        recordedByName: mockDb.employees.find((employee) => employee.id === row.recordedBy)?.fullName ?? null,
        createdAt: row.createdAt,
      }));
  },

  async startTracking(businessId, input) {
    await delay(300);
    const clean = normalizeTracking(input);
    const offering = offeringOf(clean.offeringId);
    if (!offering || offering.businessId !== businessId) throw new Error("Offering not found.");
    if (mockDb.stockItems.some((row) => row.offeringId === clean.offeringId)) throw new Error(`"${offering.name}" is already tracked.`);
    mockDb.stockItems.push({ offeringId: clean.offeringId, businessId, quantity: 0, lowStockThreshold: clean.lowStockThreshold, createdAt: new Date() });
    if (clean.quantity > 0) applyStockMove({ businessId, offeringId: clean.offeringId, delta: clean.quantity, kind: "initial", note: "Opening count", recordedBy: clean.recordedBy });
    recordAudit({ businessId, action: "stock.tracking_changed", entityId: clean.offeringId, summary: `Started tracking "${offering.name}"` });
  },

  async stopTracking(businessId, offeringId) {
    await delay(250);
    const row = requireTracked(businessId, offeringId);
    mockDb.stockItems.splice(mockDb.stockItems.indexOf(row), 1);
    recordAudit({ businessId, action: "stock.tracking_changed", entityId: offeringId, summary: `Stopped tracking "${offeringOf(offeringId)?.name ?? "item"}"` });
  },

  async setLowStockThreshold(businessId, offeringId, threshold) {
    await delay(250);
    const clean = normalizeThreshold(threshold);
    const row = requireTracked(businessId, offeringId);
    if (row.lowStockThreshold === clean) return;
    row.lowStockThreshold = clean;
    recordAudit({ businessId, action: "stock.tracking_changed", entityId: offeringId, summary: `Low-stock level for "${offeringOf(offeringId)?.name ?? "item"}" set to ${clean}` });
  },

  async adjustStock(businessId, input) {
    await delay(300);
    const clean = normalizeAdjustment(input);
    requireTracked(businessId, clean.offeringId);
    applyStockMove({ businessId, offeringId: clean.offeringId, delta: clean.delta, kind: clean.kind, note: clean.note, recordedBy: clean.recordedBy });
    recordAudit({
      businessId,
      action: "stock.adjusted",
      entityId: clean.offeringId,
      summary: `Adjusted "${offeringOf(clean.offeringId)?.name ?? "item"}" ${formatDelta(clean.delta)} (${clean.kind}): ${clean.note}`,
    });
  },
};
