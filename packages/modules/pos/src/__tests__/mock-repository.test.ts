import { describe, it, expect } from "vitest";
import { mockPosRepository } from "../mock-repository";
import { mockDb, genId, DEMO_BUSINESS_ID, auditRows, InsufficientStockError } from "@isnabero/db";
import type { CartLine } from "../types";
import { formatReceiptNumber } from "../receipt";

function makeCartLine(overrides: Partial<CartLine["offering"]> = {}, quantity = 1): CartLine {
  return {
    offering: {
      id: "test-offering-id",
      businessId: DEMO_BUSINESS_ID,
      name: "Test Item",
      barcode: null,
      description: null,
      type: "item",
      price: "100.00",
      durationMinutes: null,
      isAvailable: true,
      createdAt: new Date(),
      inclusions: [],
      ...overrides,
    },
    quantity,
  };
}

describe("mockPosRepository.checkout", () => {
  it("computes the correct total across multiple line items", async () => {
    const lines = [makeCartLine({ price: "150.00" }, 2), makeCartLine({ price: "50.00" }, 1)];
    const result = await mockPosRepository.checkout({ businessId: DEMO_BUSINESS_ID, employeeId: null, lines, method: "cash" });
    expect(result.total).toBe(350);
  });

  it("creates a payment record with the checkout amount and method", async () => {
    const beforeCount = mockDb.paymentRecords.length;
    const lines = [makeCartLine({ price: "75.00" }, 1)];
    const result = await mockPosRepository.checkout({ businessId: DEMO_BUSINESS_ID, employeeId: null, lines, method: "gcash", referenceCode: "GC123" });

    expect(mockDb.paymentRecords.length).toBe(beforeCount + 1);
    const record = mockDb.paymentRecords.find((r) => r.amount === "75");
    expect(record).toBeDefined();
    expect(record?.method).toBe("gcash");
    expect(record?.referenceCode).toBe("GC123");
    expect(record?.sourceModule).toBe("pos");

    const order = mockDb.posOrders.find((o) => o.id === result.orderId);
    expect(order?.status).toBe("paid");
  });

  it("creates one order line item per cart line", async () => {
    const lines = [makeCartLine({ id: "item-a" }, 2), makeCartLine({ id: "item-b" }, 3)];
    const result = await mockPosRepository.checkout({ businessId: DEMO_BUSINESS_ID, employeeId: null, lines, method: "cash" });
    const items = mockDb.posOrderItems.filter((item) => item.orderId === result.orderId);
    expect(items).toHaveLength(2);
    expect(items.reduce((sum, item) => sum + item.quantity, 0)).toBe(5);
  });
});

describe("mockPosRepository audit trail", () => {
  it("logs a completed sale with its total and payment method", async () => {
    const { orderId } = await mockPosRepository.checkout({ businessId: DEMO_BUSINESS_ID, employeeId: null, lines: [makeCartLine({ price: "25.00" }, 2)], method: "gcash" });
    const entry = auditRows.find((row) => row.entityId === orderId);
    expect(entry).toMatchObject({ action: "sale.completed", entityType: "sale", summary: "Sale of ₱50.00 paid by gcash" });
  });
});

describe("mockPosRepository stock", () => {
  // A tracked offering with `quantity` in stock, plus a cart line for it
  function trackedLine(quantity: number, sold: number) {
    const line = makeCartLine({ id: genId(), name: `Stocked ${genId().slice(0, 4)}` }, sold);
    mockDb.offerings.push({ ...line.offering });
    mockDb.stockItems.push({ offeringId: line.offering.id, businessId: DEMO_BUSINESS_ID, quantity, lowStockThreshold: 0, createdAt: new Date() });
    return line;
  }
  const stockOf = (id: string) => mockDb.stockItems.find((row) => row.offeringId === id)?.quantity;

  it("deducts sold quantities from tracked items and links the movement to the order", async () => {
    const line = trackedLine(10, 3);
    const { orderId } = await mockPosRepository.checkout({ businessId: DEMO_BUSINESS_ID, employeeId: null, lines: [line], method: "cash" });
    expect(stockOf(line.offering.id)).toBe(7);
    expect(mockDb.stockMovements.find((move) => move.referenceId === orderId)).toMatchObject({ delta: -3, kind: "sale", offeringId: line.offering.id });
  });

  it("leaves untracked offerings alone", async () => {
    const before = mockDb.stockMovements.length;
    await mockPosRepository.checkout({ businessId: DEMO_BUSINESS_ID, employeeId: null, lines: [makeCartLine({}, 5)], method: "cash" });
    expect(mockDb.stockMovements.length).toBe(before);
  });

  it("refuses a sale that exceeds stock and records nothing (no payment, order or deduction)", async () => {
    const line = trackedLine(2, 3);
    const payments = mockDb.paymentRecords.length;
    const orders = mockDb.posOrders.length;
    await expect(mockPosRepository.checkout({ businessId: DEMO_BUSINESS_ID, employeeId: null, lines: [makeCartLine({}, 1), line], method: "cash" })).rejects.toBeInstanceOf(InsufficientStockError);
    expect(mockDb.paymentRecords.length).toBe(payments);
    expect(mockDb.posOrders.length).toBe(orders);
    expect(stockOf(line.offering.id)).toBe(2);
  });

  it("adds up several lines for the same offering when checking stock", async () => {
    const line = trackedLine(4, 3);
    await expect(mockPosRepository.checkout({ businessId: DEMO_BUSINESS_ID, employeeId: null, lines: [line, { ...line }], method: "cash" })).rejects.toThrow(/only 4 left/);
    expect(stockOf(line.offering.id)).toBe(4);
  });

  it("sells the last unit, then reports the item as out of stock", async () => {
    const line = trackedLine(1, 1);
    await mockPosRepository.checkout({ businessId: DEMO_BUSINESS_ID, employeeId: null, lines: [line], method: "cash" });
    expect(stockOf(line.offering.id)).toBe(0);
    await expect(mockPosRepository.checkout({ businessId: DEMO_BUSINESS_ID, employeeId: null, lines: [line], method: "cash" })).rejects.toThrow(/out of stock/);
  });
});

describe("receipts", () => {
  const sell = (price: string, quantity = 1) => mockPosRepository.checkout({ businessId: DEMO_BUSINESS_ID, employeeId: null, lines: [makeCartLine({ price }, quantity)], method: "cash" });

  it("numbers sales one after another and returns the number from checkout", async () => {
    const first = await sell("10.00");
    const second = await sell("10.00");
    expect(second.receiptNumber).toBe(first.receiptNumber + 1);
    const highest = Math.max(...mockDb.posOrders.map((order) => order.receiptNumber));
    expect(highest).toBe(second.receiptNumber);
  });

  it("builds a receipt by order id and by payment record id", async () => {
    const real = mockDb.offerings.find((offering) => offering.name === "Extra 5 Prints"); // untracked, so no stock effects
    const result = await mockPosRepository.checkout({
      businessId: DEMO_BUSINESS_ID,
      employeeId: null,
      lines: [makeCartLine({ id: real?.id, name: "Extra 5 Prints", price: "25.00" }, 3)],
      method: "cash",
    });
    const byOrder = await mockPosRepository.getReceipt(DEMO_BUSINESS_ID, { orderId: result.orderId });
    expect(byOrder).toMatchObject({ receiptNumber: result.receiptNumber, total: 75, voided: false, method: "cash" });
    expect(byOrder?.lines).toEqual([{ name: "Extra 5 Prints", quantity: 3, unitPrice: 25, amount: 75 }]);
    expect(byOrder?.business.name).toBe("Sample Business");
    const order = mockDb.posOrders.find((item) => item.id === result.orderId);
    const byPayment = await mockPosRepository.getReceipt(DEMO_BUSINESS_ID, { paymentRecordId: order?.paymentRecordId as string });
    expect(byPayment?.orderId).toBe(result.orderId);
  });

  it("marks the receipt voided once its payment is voided", async () => {
    const result = await sell("5.00");
    const order = mockDb.posOrders.find((item) => item.id === result.orderId);
    const payment = mockDb.paymentRecords.find((item) => item.id === order?.paymentRecordId);
    if (payment) payment.voidedAt = new Date();
    expect((await mockPosRepository.getReceipt(DEMO_BUSINESS_ID, { orderId: result.orderId }))?.voided).toBe(true);
  });

  it("returns null for an unknown sale or another business", async () => {
    const result = await sell("5.00");
    expect(await mockPosRepository.getReceipt(DEMO_BUSINESS_ID, { paymentRecordId: genId() })).toBeNull();
    expect(await mockPosRepository.getReceipt(genId(), { orderId: result.orderId })).toBeNull();
  });

  it("keeps historical seed receipts unique and in order", () => {
    const numbers = mockDb.posOrders.map((order) => order.receiptNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("formats receipt numbers with a fixed width", () => {
    expect(formatReceiptNumber(7)).toBe("000007");
    expect(formatReceiptNumber(123456)).toBe("123456");
  });
});

describe("mockPosRepository offline sales", () => {
  it("records a sale once however many times the same clientId is sent", async () => {
    const clientId = genId();
    const input = { businessId: DEMO_BUSINESS_ID, employeeId: null, lines: [makeCartLine({ price: "40.00" }, 2)], method: "cash" as const, clientId };
    const first = await mockPosRepository.checkout(input);
    const orders = mockDb.posOrders.length;
    const again = await mockPosRepository.checkout(input);
    expect(again).toMatchObject({ orderId: first.orderId, receiptNumber: first.receiptNumber, total: 80, duplicate: true });
    expect(mockDb.posOrders.length).toBe(orders);
  });

  it("dates the sale when it happened, never in the future", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000);
    const past = await mockPosRepository.checkout({ businessId: DEMO_BUSINESS_ID, employeeId: null, lines: [makeCartLine({}, 1)], method: "cash", soldAt: twoHoursAgo });
    expect(mockDb.posOrders.find((order) => order.id === past.orderId)?.createdAt).toEqual(twoHoursAgo);
    const future = await mockPosRepository.checkout({ businessId: DEMO_BUSINESS_ID, employeeId: null, lines: [makeCartLine({}, 1)], method: "cash", soldAt: new Date(Date.now() + 86_400_000) });
    expect(mockDb.posOrders.find((order) => order.id === future.orderId)!.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
