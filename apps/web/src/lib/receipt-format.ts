import { formatReceiptNumber, type Receipt } from "@isnabero/module-pos";

// Shown on every receipt: these are sales receipts, not BIR-registered official receipts
export const RECEIPT_DISCLAIMER = "This is a sales receipt, not an official receipt.";

const METHOD_LABELS: Record<string, string> = { cash: "Cash", gcash: "GCash", bank_transfer: "Bank transfer", other: "Other" };
const MONEY = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const receiptMethodLabel = (method: string) => METHOD_LABELS[method] ?? method;
export const receiptMoney = (amount: number) => `₱${MONEY.format(amount)}`;
export const receiptDateTime = (date: Date) => date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
export const receiptTitle = (receipt: Receipt) => `Receipt #${formatReceiptNumber(receipt.receiptNumber)}`;
