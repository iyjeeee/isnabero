import { describe, expect, it } from "vitest";
import { buildPdf, formatPdfCell } from "../export-pdf";

describe("formatPdfCell", () => {
  it("writes money as PHP with thousands separators and 2 decimals (the ₱ glyph isn't in PDF fonts)", () => {
    expect(formatPdfCell(1234.5, true)).toBe("PHP 1,234.50");
    expect(formatPdfCell(0, true)).toBe("PHP 0.00");
  });

  it("leaves non-money values alone", () => {
    expect(formatPdfCell(7, false)).toBe("7");
    expect(formatPdfCell("Rent", false)).toBe("Rent");
    expect(formatPdfCell("n/a", true)).toBe("n/a");
  });
});

describe("buildPdf", () => {
  const rows = Array.from({ length: 80 }, (_, i) => ({ Date: "2026-03-10", Description: `Row ${i}`, Amount: i * 10 }));

  it("produces a real multi-page PDF for a long table", async () => {
    const doc = await buildPdf({ title: "Expenses", businessName: "Sample Business", subtitle: "All dates", rows, moneyColumns: ["Amount"] });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    const bytes = new Uint8Array(doc.output("arraybuffer"));
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("uses landscape for wide tables and portrait otherwise", async () => {
    const wide = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`C${i}`, "x"]));
    expect((await buildPdf({ title: "T", businessName: "B", rows: [wide] })).internal.pageSize.getWidth()).toBeGreaterThan(800);
    expect((await buildPdf({ title: "T", businessName: "B", rows: [{ A: "x" }] })).internal.pageSize.getWidth()).toBeLessThan(700);
  });
});
