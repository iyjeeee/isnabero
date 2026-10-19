import { describe, it, expect } from "vitest";
import { mockCatalogRepository } from "../mock-repository";
import { mockDb, genId, DEMO_BUSINESS_ID, auditRows } from "@isnabero/db";
import { OfferingInUseError } from "../rules";

async function addBundle(name: string) {
  return mockCatalogRepository.createOfferingWithInclusions(DEMO_BUSINESS_ID, {
    offering: { name, description: null, type: "bundle", price: "300", durationMinutes: 30, isAvailable: true },
    inclusions: [{ label: "Unli shots", quantity: null }, { label: "Prints", quantity: 2 }],
  });
}

describe("mockCatalogRepository.updateOffering", () => {
  it("edits details, replaces inclusions, keeps availability, and logs it", async () => {
    const bundle = await addBundle("Edit Me");
    await mockCatalogRepository.toggleAvailability(bundle.id, false);
    const updated = await mockCatalogRepository.updateOffering(DEMO_BUSINESS_ID, bundle.id, {
      offering: { name: "  Edited  ", description: "new", type: "bundle", price: "350.5", durationMinutes: 45, isAvailable: true },
      inclusions: [{ label: "Photo strip", quantity: 1 }],
    });
    expect(updated).toMatchObject({ name: "Edited", description: "new", price: "350.5", durationMinutes: 45, isAvailable: false });
    expect(updated.inclusions.map((inclusion) => inclusion.label)).toEqual(["Photo strip"]);
    expect(mockDb.offeringInclusions.filter((inclusion) => inclusion.offeringId === bundle.id)).toHaveLength(1);
    expect(auditRows.find((row) => row.entityId === bundle.id && row.action === "offering.updated")?.summary).toBe('Edited bundle "Edited" (₱350.50)');
  });

  it("drops inclusions when a bundle becomes an item, and rejects blank names or negative prices", async () => {
    const bundle = await addBundle("Becomes Item");
    const asItem = await mockCatalogRepository.updateOffering(DEMO_BUSINESS_ID, bundle.id, {
      offering: { name: "Becomes Item", description: null, type: "item", price: "10", durationMinutes: null, isAvailable: true },
      inclusions: [{ label: "ignored", quantity: 1 }],
    });
    expect(asItem.inclusions).toEqual([]);
    const base = { description: null, type: "item" as const, durationMinutes: null, isAvailable: true };
    await expect(mockCatalogRepository.updateOffering(DEMO_BUSINESS_ID, bundle.id, { offering: { ...base, name: "  ", price: "1" }, inclusions: [] })).rejects.toThrow("Name is required");
    await expect(mockCatalogRepository.updateOffering(DEMO_BUSINESS_ID, bundle.id, { offering: { ...base, name: "x", price: "-1" }, inclusions: [] })).rejects.toThrow("Price must be 0 or more");
  });

  it("won't edit another business's offering", async () => {
    const bundle = await addBundle("Mine");
    await expect(mockCatalogRepository.updateOffering("other-business", bundle.id, { offering: { name: "x", description: null, type: "item", price: "1", durationMinutes: null, isAvailable: true }, inclusions: [] })).rejects.toThrow("Offering not found");
  });
});

describe("mockCatalogRepository.deleteOffering", () => {
  it("deletes an unused offering with its inclusions and stock tracking, and logs it", async () => {
    const bundle = await addBundle("Delete Me");
    mockDb.stockItems.push({ offeringId: bundle.id, businessId: DEMO_BUSINESS_ID, quantity: 3, lowStockThreshold: 0, createdAt: new Date() });
    mockDb.stockMovements.push({ id: genId(), businessId: DEMO_BUSINESS_ID, offeringId: bundle.id, delta: 3, kind: "initial", note: null, referenceId: null, recordedBy: null, createdAt: new Date() });
    await mockCatalogRepository.deleteOffering(DEMO_BUSINESS_ID, bundle.id);
    expect(mockDb.offerings.some((offering) => offering.id === bundle.id)).toBe(false);
    expect(mockDb.offeringInclusions.some((inclusion) => inclusion.offeringId === bundle.id)).toBe(false);
    expect(mockDb.stockItems.some((row) => row.offeringId === bundle.id)).toBe(false);
    expect(mockDb.stockMovements.some((row) => row.offeringId === bundle.id)).toBe(false);
    expect(auditRows.find((row) => row.entityId === bundle.id && row.action === "offering.deleted")?.summary).toBe('Deleted bundle "Delete Me"');
  });

  it("refuses when a sale or booking uses the offering", async () => {
    const sold = await addBundle("Sold Once");
    mockDb.posOrderItems.push({ id: genId(), orderId: "x", offeringId: sold.id, quantity: 1, unitPrice: "300" });
    await expect(mockCatalogRepository.deleteOffering(DEMO_BUSINESS_ID, sold.id)).rejects.toThrow(OfferingInUseError);
    const booked = await addBundle("Booked Once");
    mockDb.bookings.push({ id: genId(), businessId: DEMO_BUSINESS_ID, offeringId: booked.id, mode: "appointment", customerName: "C", customerContact: null, startTime: new Date(), endTime: new Date(), status: "cancelled", paymentRecordId: null, createdAt: new Date() });
    await expect(mockCatalogRepository.deleteOffering(DEMO_BUSINESS_ID, booked.id)).rejects.toThrow("Mark it sold out instead");
    expect(mockDb.offerings.some((offering) => offering.id === sold.id)).toBe(true);
  });
});
