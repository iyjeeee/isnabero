import { describe, expect, it } from "vitest";
import type { Receipt } from "@isnabero/module-pos";
import { buildReceiptPdf, receiptPdfFilename } from "../receipt-pdf";
import { receiptMethodLabel, receiptMoney } from "../receipt-format";

const receipt = (lineCount: number, overrides: Partial<Receipt> = {}): Receipt => ({
  orderId: "o1",
  receiptNumber: 42,
  issuedAt: new Date("2026-03-10T10:30:00"),
  business: { name: "Sample Business", address: "123 Rizal Street, Quezon City", tin: "123-456-789-000", contactNumber: "0917 123 4567", footer: "Thank you!" },
  cashierName: "Pedro Reyes",
  method: "gcash",
  referenceCode: "GC123456",
  lines: Array.from({ length: lineCount }, (_, i) => ({ name: `Item ${i}`, quantity: 2, unitPrice: 50, amount: 100 })),
  total: lineCount * 100,
  voided: false,
  ...overrides,
});

describe("receipt formatting", () => {
  it("labels payment methods and formats pesos", () => {
    expect(receiptMethodLabel("bank_transfer")).toBe("Bank transfer");
    expect(receiptMethodLabel("mystery")).toBe("mystery");
    expect(receiptMoney(1234.5)).toBe("₱1,234.50");
  });
});

describe("buildReceiptPdf", () => {
  it("makes a single 80 mm-wide PDF page that grows with the number of lines", async () => {
    const short = await buildReceiptPdf(receipt(1));
    const long = await buildReceiptPdf(receipt(30));
    expect(short.getNumberOfPages()).toBe(1);
    expect(long.getNumberOfPages()).toBe(1);
    expect(short.internal.pageSize.getWidth()).toBeCloseTo(80, 0);
    expect(long.internal.pageSize.getHeight()).toBeGreaterThan(short.internal.pageSize.getHeight());
    expect(String.fromCharCode(...new Uint8Array(short.output("arraybuffer")).slice(0, 5))).toBe("%PDF-");
  });

  it("still builds when optional business details are missing, and for voided sales", async () => {
    const doc = await buildReceiptPdf(receipt(2, { voided: true, referenceCode: null, cashierName: null, business: { name: "Bare Shop", address: null, tin: null, contactNumber: null, footer: null } }));
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("names the file after the zero-padded receipt number", () => {
    expect(receiptPdfFilename(receipt(1))).toBe("receipt-000042.pdf");
  });
});
