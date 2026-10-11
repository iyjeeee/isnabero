export interface ReceiptBusiness {
  name: string;
  address: string | null;
  tin: string | null;
  contactNumber: string | null;
  footer: string | null;
}

export interface ReceiptLine {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

// Receipt: everything needed to print a sales receipt for one POS order
export interface Receipt {
  orderId: string;
  receiptNumber: number;
  issuedAt: Date;
  business: ReceiptBusiness;
  cashierName: string | null;
  method: string;
  referenceCode: string | null;
  lines: ReceiptLine[];
  total: number;
  voided: boolean; // the sale's payment was voided after the fact
}

// ReceiptRef: look a receipt up from the order (right after checkout) or from its payment record (Payments page)
export type ReceiptRef = { orderId: string } | { paymentRecordId: string };

// formatReceiptNumber: 000123 — fixed width so receipts sort and read consistently
export function formatReceiptNumber(receiptNumber: number): string {
  return String(receiptNumber).padStart(6, "0");
}

export function receiptRefKey(ref: ReceiptRef): string {
  return "orderId" in ref ? `order:${ref.orderId}` : `payment:${ref.paymentRecordId}`;
}
