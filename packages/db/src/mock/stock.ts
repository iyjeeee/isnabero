import { InsufficientStockError, type StockKind } from "../inventory";
import { mockDb, genId } from "./store";
import { recordAudit } from "./audit";

export interface StockMove {
  businessId: string;
  offeringId: string;
  delta: number; // non-zero; negative takes stock out
  kind: StockKind;
  note?: string | null;
  referenceId?: string | null;
  recordedBy?: string | null;
}

// Mock-mode stock rules, shared by the POS and Inventory mock repositories. In Supabase mode the same rules are enforced
// by the stock_movements trigger + CHECK constraint (migration 0006), so Supabase repositories must NOT call these.

function offeringName(offeringId: string): string {
  return mockDb.offerings.find((offering) => offering.id === offeringId)?.name ?? "this item";
}

// assertStockForSale: throws InsufficientStockError if any tracked line can't be covered. Untracked offerings are ignored;
// lines for the same offering are added together first.
export function assertStockForSale(businessId: string, lines: { offeringId: string; quantity: number }[]): void {
  const wanted = new Map<string, number>();
  for (const line of lines) wanted.set(line.offeringId, (wanted.get(line.offeringId) ?? 0) + line.quantity);
  for (const [offeringId, quantity] of wanted) {
    const item = mockDb.stockItems.find((row) => row.offeringId === offeringId && row.businessId === businessId);
    if (item && item.quantity < quantity) throw new InsufficientStockError(offeringName(offeringId), item.quantity);
  }
}

// applyStockMove: records the movement and updates the count; refuses to go below zero
export function applyStockMove(move: StockMove): void {
  const item = mockDb.stockItems.find((row) => row.offeringId === move.offeringId && row.businessId === move.businessId);
  if (!item) throw new Error("This item isn't tracked in inventory.");
  if (item.quantity + move.delta < 0) throw new InsufficientStockError(offeringName(move.offeringId), item.quantity);
  item.quantity += move.delta;
  mockDb.stockMovements.push({
    id: genId(),
    businessId: move.businessId,
    offeringId: move.offeringId,
    delta: move.delta,
    kind: move.kind,
    note: move.note ?? null,
    referenceId: move.referenceId ?? null,
    recordedBy: move.recordedBy ?? null,
    createdAt: new Date(),
  });
}

// voidMockSale: mock twin of the payment_records void trigger (migration 0010) — marks the POS order behind a voided payment
// as voided and returns its tracked items to stock once. Supabase repositories must NOT call this.
export function voidMockSale(paymentRecordId: string): void {
  const order = mockDb.posOrders.find((item) => item.paymentRecordId === paymentRecordId);
  if (!order || order.status === "voided") return;
  order.status = "voided";
  for (const line of mockDb.posOrderItems.filter((item) => item.orderId === order.id)) {
    if (!mockDb.stockItems.some((row) => row.offeringId === line.offeringId && row.businessId === order.businessId)) continue; // untracked
    const note = `Sale #${order.receiptNumber} voided`;
    applyStockMove({ businessId: order.businessId, offeringId: line.offeringId, delta: line.quantity, kind: "return", note, referenceId: order.id });
    recordAudit({ businessId: order.businessId, action: "stock.adjusted", entityId: line.offeringId, summary: `Adjusted "${offeringName(line.offeringId)}" +${line.quantity} (return): ${note}` });
  }
}
