import { describe, it, expect } from "vitest";
import { mockCatalogRepository } from "../mock-repository";
import { DEMO_BUSINESS_ID } from "@isnabero/db";

describe("mockCatalogRepository", () => {
  it("lists the seeded offerings for the demo business", async () => {
    const offerings = await mockCatalogRepository.listOfferings(DEMO_BUSINESS_ID);
    expect(offerings.length).toBeGreaterThanOrEqual(2);
    expect(offerings.some((offering) => offering.name === "Sisig")).toBe(true);
  });

  it("returns no offerings for a business that doesn't exist", async () => {
    const offerings = await mockCatalogRepository.listOfferings("00000000-0000-0000-0000-999999999999");
    expect(offerings).toEqual([]);
  });

  it("creates a bundle with its inclusions in one call", async () => {
    const before = await mockCatalogRepository.listOfferings(DEMO_BUSINESS_ID);

    const created = await mockCatalogRepository.createOfferingWithInclusions(DEMO_BUSINESS_ID, {
      offering: { name: "Test Bundle", description: "A test bundle", type: "bundle", price: "299.00", durationMinutes: 15, isAvailable: true },
      inclusions: [
        { label: "Unli test shots", quantity: null },
        { label: "Test prints", quantity: 3 },
      ],
    });

    expect(created.name).toBe("Test Bundle");
    expect(created.inclusions).toHaveLength(2);
    expect(created.inclusions.find((inclusion) => inclusion.label === "Test prints")?.quantity).toBe(3);

    const after = await mockCatalogRepository.listOfferings(DEMO_BUSINESS_ID);
    expect(after.length).toBe(before.length + 1);
  });

  it("toggles offering availability", async () => {
    const created = await mockCatalogRepository.createOfferingWithInclusions(DEMO_BUSINESS_ID, {
      offering: { name: "Toggle Test Item", type: "item", price: "50.00", isAvailable: true },
      inclusions: [],
    });
    expect(created.isAvailable).toBe(true);

    await mockCatalogRepository.toggleAvailability(created.id, false);
    const afterToggle = await mockCatalogRepository.listOfferings(DEMO_BUSINESS_ID);
    const toggled = afterToggle.find((offering) => offering.id === created.id);
    expect(toggled?.isAvailable).toBe(false);
  });
});
