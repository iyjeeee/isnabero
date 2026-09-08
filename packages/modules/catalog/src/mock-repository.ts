import { mockDb, delay, genId } from "@isnabero/db";
import type { CatalogRepository, CreateOfferingInput } from "./repository";
import type { OfferingWithInclusions } from "./types";

// mockCatalogRepository: in-memory stand-in for Supabase, used while VITE_DATA_SOURCE=mock (the default)
export const mockCatalogRepository: CatalogRepository = {
  async listOfferings(businessId) {
    await delay();
    return mockDb.offerings
      .filter((offering) => offering.businessId === businessId)
      .map((offering) => ({
        ...offering,
        inclusions: mockDb.offeringInclusions.filter((inclusion) => inclusion.offeringId === offering.id),
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  async createOfferingWithInclusions(businessId, input: CreateOfferingInput) {
    await delay();
    const offering = {
      id: genId(),
      businessId,
      name: input.offering.name,
      description: input.offering.description ?? null,
      type: input.offering.type ?? "item",
      price: String(input.offering.price),
      durationMinutes: input.offering.durationMinutes ?? null,
      isAvailable: input.offering.isAvailable ?? true,
      createdAt: new Date(),
    };
    mockDb.offerings.push(offering);

    const inclusions = input.inclusions.map((inclusion) => ({
      id: genId(),
      offeringId: offering.id,
      label: inclusion.label,
      quantity: inclusion.quantity,
    }));
    mockDb.offeringInclusions.push(...inclusions);

    return { ...offering, inclusions } as OfferingWithInclusions;
  },

  async toggleAvailability(offeringId, isAvailable) {
    await delay(150);
    const offering = mockDb.offerings.find((item) => item.id === offeringId);
    if (offering) offering.isAvailable = isAvailable;
  },
};
