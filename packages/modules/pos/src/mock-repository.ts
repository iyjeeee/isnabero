import { mockDb, delay, genId, recordAudit, auditPeso, assertStockForSale, applyStockMove } from "@isnabero/db";
import type { CheckoutInput, CheckoutResult, PosRepository } from "./repository";
import type { Receipt, ReceiptRef } from "./receipt";

// nextReceiptNumber: one more than the highest number issued for this business (voided sales keep theirs)
function nextReceiptNumber(businessId: string): number {
  return mockDb.posOrders.reduce((max, order) => (order.businessId === businessId ? Math.max(max, order.receiptNumber) : max), 0) + 1;
}

export const mockPosRepository: PosRepository = {
  async checkout({ businessId, employeeId, lines, method, referenceCode, clientId, soldAt }: CheckoutInput): Promise<CheckoutResult> {
    await delay(400);
    // A sale already recorded under this clientId comes back as is (an offline sale that was sent twice)
    const existing = clientId ? mockDb.posOrders.find((order) => order.businessId === businessId && order.clientId === clientId) : undefined;
    if (existing) return { orderId: existing.id, total: Number(existing.total), receiptNumber: existing.receiptNumber, duplicate: true };
    const when = soldAt && soldAt.getTime() < Date.now() ? soldAt : new Date();
    // Refuse before recording anything, so a stock shortage never leaves a half-recorded sale
    assertStockForSale(businessId, lines.map((line) => ({ offeringId: line.offering.id, quantity: line.quantity })));
    const total = lines.reduce((sum, line) => sum + Number(line.offering.price) * line.quantity, 0);

    const payment = {
      id: genId(),
      businessId,
      sourceModule: "pos" as const,
      method,
      referenceCode: referenceCode ?? null,
      amount: String(total),
      createdAt: when,
      voidedAt: null,
    };
    mockDb.paymentRecords.push(payment);

    const order = {
      id: genId(),
      businessId,
      employeeId,
      status: "paid" as const,
      total: String(total),
      paymentRecordId: payment.id,
      receiptNumber: nextReceiptNumber(businessId),
      clientId: clientId ?? null,
      createdAt: when,
    };
    mockDb.posOrders.push(order);

    mockDb.posOrderItems.push(
      ...lines.map((line) => ({
        id: genId(),
        orderId: order.id,
        offeringId: line.offering.id,
        quantity: line.quantity,
        unitPrice: line.offering.price,
      })),
    );

    // Take sold quantities out of stock (only offerings that are tracked)
    for (const line of lines) {
      if (mockDb.stockItems.some((row) => row.offeringId === line.offering.id && row.businessId === businessId)) {
        applyStockMove({ businessId, offeringId: line.offering.id, delta: -line.quantity, kind: "sale", referenceId: order.id, recordedBy: employeeId });
      }
    }
    recordAudit({ businessId, action: "sale.completed", entityId: order.id, summary: `Sale of ${auditPeso(total)} paid by ${method}` });
    return { orderId: order.id, total, receiptNumber: order.receiptNumber };
  },

  async getReceipt(businessId: string, ref: ReceiptRef): Promise<Receipt | null> {
    await delay(150);
    const order = mockDb.posOrders.find(
      (item) => item.businessId === businessId && ("orderId" in ref ? item.id === ref.orderId : item.paymentRecordId === ref.paymentRecordId),
    );
    const business = mockDb.businesses.find((item) => item.id === businessId);
    if (!order || !business) return null;
    const payment = mockDb.paymentRecords.find((item) => item.id === order.paymentRecordId);
    const cashier = mockDb.employees.find((item) => item.id === order.employeeId);
    const lines = mockDb.posOrderItems
      .filter((item) => item.orderId === order.id)
      .map((item) => {
        const unitPrice = Number(item.unitPrice);
        return { name: mockDb.offerings.find((offering) => offering.id === item.offeringId)?.name ?? "Item", quantity: item.quantity, unitPrice, amount: unitPrice * item.quantity };
      });
    return {
      orderId: order.id,
      receiptNumber: order.receiptNumber,
      issuedAt: order.createdAt,
      business: { name: business.name, address: business.address, tin: business.tin, contactNumber: business.contactNumber, footer: business.receiptFooter },
      cashierName: cashier?.fullName ?? null,
      method: payment?.method ?? "other",
      referenceCode: payment?.referenceCode ?? null,
      lines,
      total: Number(order.total),
      voided: order.status === "voided" || Boolean(payment?.voidedAt),
    };
  },
};
