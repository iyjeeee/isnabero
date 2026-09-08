import type { CartLine } from "./types";

export interface CheckoutInput {
  businessId: string;
  employeeId: string | null;
  lines: CartLine[];
  method: "cash" | "gcash" | "bank_transfer" | "other";
  referenceCode?: string;
}

export interface CheckoutResult {
  orderId: string;
  total: number;
}

// PosRepository: data-access contract for POS checkout — writes a payment record, the order, and its
// line items. Hooks call this instead of Supabase/mock storage directly.
export interface PosRepository {
  checkout(input: CheckoutInput): Promise<CheckoutResult>;
}
