import { describe, expect, it } from "vitest";
import { mockCoreRepository } from "../mock-repository";
import { mockDb, genId, auditRows, DEMO_BUSINESS_ID } from "@isnabero/db";

// makeSale: a paid POS sale for one offering, built straight in the mock store (what checkout leaves behind)
function makeSale({ tracked, quantity = 3, source = "pos" as "pos" | "booking" }: { tracked: boolean; quantity?: number; source?: "pos" | "booking" }) {
  const offeringId = genId();
  mockDb.offerings.push({ id: offeringId, businessId: DEMO_BUSINESS_ID, name: `Voidable ${offeringId.slice(0, 4)}`, description: null, type: "item", price: "50.00", durationMinutes: null, isAvailable: true, createdAt: new Date(), barcode: null });
  if (tracked) mockDb.stockItems.push({ offeringId, businessId: DEMO_BUSINESS_ID, quantity: 10, lowStockThreshold: 0, createdAt: new Date() });
  const payment = { id: genId(), businessId: DEMO_BUSINESS_ID, sourceModule: source, method: "cash" as const, referenceCode: null, amount: String(quantity * 50), createdAt: new Date(), voidedAt: null };
  mockDb.paymentRecords.push(payment);
  const order = { id: genId(), businessId: DEMO_BUSINESS_ID, employeeId: null, status: "paid" as const, total: payment.amount, paymentRecordId: payment.id, receiptNumber: 9000 + mockDb.posOrders.length, clientId: null, createdAt: new Date() };
  mockDb.posOrders.push(order);
  mockDb.posOrderItems.push({ id: genId(), orderId: order.id, offeringId, quantity, unitPrice: "50.00" });
  if (tracked) mockDb.stockItems.find((row) => row.offeringId === offeringId)!.quantity -= quantity; // what the sale took out
  return { offeringId, payment, order };
}
const stockOf = (id: string) => mockDb.stockItems.find((row) => row.offeringId === id)?.quantity;

describe("voiding a POS payment", () => {
  it("returns tracked items to stock, marks the order voided and logs the return", async () => {
    const { offeringId, payment, order } = makeSale({ tracked: true, quantity: 3 });
    expect(stockOf(offeringId)).toBe(7);
    await mockCoreRepository.voidPaymentRecord(DEMO_BUSINESS_ID, payment.id);
    expect(stockOf(offeringId)).toBe(10);
    expect(order.status).toBe("voided");
    expect(mockDb.stockMovements.find((move) => move.referenceId === order.id)).toMatchObject({ delta: 3, kind: "return", note: `Sale #${order.receiptNumber} voided` });
    expect(auditRows.some((row) => row.action === "stock.adjusted" && row.summary.endsWith(`+3 (return): Sale #${order.receiptNumber} voided`))).toBe(true);
  });

  it("restocks only once, even if voided twice", async () => {
    const { offeringId, payment } = makeSale({ tracked: true, quantity: 2 });
    await mockCoreRepository.voidPaymentRecord(DEMO_BUSINESS_ID, payment.id);
    await mockCoreRepository.voidPaymentRecord(DEMO_BUSINESS_ID, payment.id);
    expect(stockOf(offeringId)).toBe(10);
  });

  it("ignores untracked items and non-POS payments", async () => {
    const before = mockDb.stockMovements.length;
    const untracked = makeSale({ tracked: false });
    await mockCoreRepository.voidPaymentRecord(DEMO_BUSINESS_ID, untracked.payment.id);
    expect(untracked.order.status).toBe("voided");
    const booking = makeSale({ tracked: true, source: "booking" });
    await mockCoreRepository.voidPaymentRecord(DEMO_BUSINESS_ID, booking.payment.id);
    expect(stockOf(booking.offeringId)).toBe(7);
    expect(mockDb.stockMovements.length).toBe(before);
  });
});
