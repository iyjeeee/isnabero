import type { CheckoutLine } from "./types";
import type { Receipt, ReceiptRef } from "./receipt";

export interface CheckoutInput {
  businessId: string;
  employeeId: string | null;
  lines: CheckoutLine[];
  method: "cash" | "gcash" | "bank_transfer" | "other";
  referenceCode?: string;
  // clientId: made once per sale and kept when it is retried, so a sale sent twice is recorded once (offline sales)
  clientId?: string;
  // soldAt: when the sale happened, if earlier than now (offline sales); never in the future
  soldAt?: Date;
}

export interface CheckoutResult {
  duplicate?: boolean; // true when this clientId was already recorded and the existing sale is returned
  orderId: string;
  total: number;
  receiptNumber: number;
}

// PosRepository: data-access contract for POS checkout — writes a payment record, the order, and its
// line items. Hooks call this instead of Supabase/mock storage directly.
export interface PosRepository {
  checkout(input: CheckoutInput): Promise<CheckoutResult>;
  // getReceipt: null when no POS sale matches (e.g. a payment record that came from a booking)
  getReceipt(businessId: string, ref: ReceiptRef): Promise<Receipt | null>;
}
