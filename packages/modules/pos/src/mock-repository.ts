import { mockDb, delay, genId } from "@isnabero/db";
import type { CheckoutInput, CheckoutResult, PosRepository } from "./repository";

export const mockPosRepository: PosRepository = {
  async checkout({ businessId, employeeId, lines, method, referenceCode }: CheckoutInput): Promise<CheckoutResult> {
    await delay(400);
    const total = lines.reduce((sum, line) => sum + Number(line.offering.price) * line.quantity, 0);

    const payment = {
      id: genId(),
      businessId,
      sourceModule: "pos" as const,
      method,
      referenceCode: referenceCode ?? null,
      amount: String(total),
      createdAt: new Date(),
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
      createdAt: new Date(),
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

    return { orderId: order.id, total };
  },
};
