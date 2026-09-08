import type { posOrders, posOrderItems } from "@isnabero/db";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { OfferingWithInclusions } from "@isnabero/module-catalog";

export type PosOrder = InferSelectModel<typeof posOrders>;
export type NewPosOrder = InferInsertModel<typeof posOrders>;

export type PosOrderItem = InferSelectModel<typeof posOrderItems>;
export type NewPosOrderItem = InferInsertModel<typeof posOrderItems>;

// CartLine: an in-progress line item before checkout — references the offering for name/price display
export interface CartLine {
  offering: OfferingWithInclusions;
  quantity: number;
}
