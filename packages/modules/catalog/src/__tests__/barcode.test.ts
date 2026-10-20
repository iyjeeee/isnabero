import { describe, expect, it } from "vitest";
import { DEMO_BUSINESS_ID } from "@isnabero/db";
import { mockCatalogRepository } from "../mock-repository";
import { DUPLICATE_BARCODE_MESSAGE, normalizeBarcode } from "../rules";

const base = { name: "Coded", description: null, type: "item" as const, price: "10.00", durationMinutes: null, isAvailable: true };

describe("normalizeBarcode", () => {
  it("trims, treats blank as none, and rejects very long codes", () => {
    expect(normalizeBarcode("  ABC ")).toBe("ABC");
    expect(normalizeBarcode("   ")).toBeNull();
    expect(normalizeBarcode(null)).toBeNull();
    expect(() => normalizeBarcode("x".repeat(65))).toThrow(/64/);
  });
});

describe("barcodes in the mock catalog", () => {
  it("saves a code, refuses a repeat in any letter case, and allows keeping your own", async () => {
    const first = await mockCatalogRepository.createOfferingWithInclusions(DEMO_BUSINESS_ID, { offering: { ...base, barcode: "  UNIQ-9 " }, inclusions: [] });
    expect(first.barcode).toBe("UNIQ-9");
    await expect(mockCatalogRepository.createOfferingWithInclusions(DEMO_BUSINESS_ID, { offering: { ...base, name: "Other", barcode: "uniq-9" }, inclusions: [] })).rejects.toThrow(DUPLICATE_BARCODE_MESSAGE);
    // editing the same item with its own code is fine, and a code can be cleared
    const same = await mockCatalogRepository.updateOffering(DEMO_BUSINESS_ID, first.id, { offering: { ...base, barcode: "UNIQ-9" }, inclusions: [] });
    expect(same.barcode).toBe("UNIQ-9");
    const cleared = await mockCatalogRepository.updateOffering(DEMO_BUSINESS_ID, first.id, { offering: { ...base, barcode: null }, inclusions: [] });
    expect(cleared.barcode).toBeNull();
  });
});
