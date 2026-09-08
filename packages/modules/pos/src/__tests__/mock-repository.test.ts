import { describe, it, expect } from "vitest";
import { mockPosRepository } from "../mock-repository";
import { mockDb, DEMO_BUSINESS_ID } from "@isnabero/db";
import type { CartLine } from "../types";

function makeCartLine(overrides: Partial<CartLine["offering"]> = {}, quantity = 1): CartLine {
  return {
    offering: {
      id: "test-offering-id",
      businessId: DEMO_BUSINESS_ID,
      name: "Test Item",
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
