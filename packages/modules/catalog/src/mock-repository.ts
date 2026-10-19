import { mockDb, delay, genId, recordAudit, auditPeso } from "@isnabero/db";
import type { CatalogRepository, CreateOfferingInput } from "./repository";
import type { OfferingWithInclusions } from "./types";
import { OfferingInUseError } from "./rules";

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

    recordAudit({ businessId, action: "offering.created", entityId: offering.id, summary: `Added ${offering.type} "${offering.name}" at ${auditPeso(offering.price)}` });
    return { ...offering, inclusions } as OfferingWithInclusions;
  },

  async toggleAvailability(offeringId, isAvailable) {
    await delay(150);
    const offering = mockDb.offerings.find((item) => item.id === offeringId);
    if (offering && offering.isAvailable !== isAvailable) {
      offering.isAvailable = isAvailable;
      recordAudit({ businessId: offering.businessId, action: "offering.availability_changed", entityId: offering.id, summary: `Marked "${offering.name}" ${isAvailable ? "available" : "sold out"}` });
    }
  },

  async updateOffering(businessId, offeringId, input: CreateOfferingInput) {
    await delay();
    const offering = mockDb.offerings.find((item) => item.id === offeringId && item.businessId === businessId);
    if (!offering) throw new Error("Offering not found");
    const name = input.offering.name.trim();
    if (!name) throw new Error("Name is required");
    if (Number(input.offering.price) < 0) throw new Error("Price must be 0 or more");
    const type = input.offering.type ?? "item";
    Object.assign(offering, { name, description: input.offering.description ?? null, type, price: String(input.offering.price), durationMinutes: input.offering.durationMinutes ?? null });

    // Replace the inclusions in place (bundles only), like the update_offering() database function
    mockDb.offeringInclusions.splice(0, mockDb.offeringInclusions.length, ...mockDb.offeringInclusions.filter((inclusion) => inclusion.offeringId !== offeringId));
    const inclusions = (type === "bundle" ? input.inclusions : []).map((inclusion) => ({ id: genId(), offeringId, label: inclusion.label, quantity: inclusion.quantity }));
    mockDb.offeringInclusions.push(...inclusions);

    recordAudit({ businessId, action: "offering.updated", entityId: offeringId, summary: `Edited ${type} "${name}" (${auditPeso(offering.price)})` });
    return { ...offering, inclusions } as OfferingWithInclusions;
  },

  async deleteOffering(businessId, offeringId) {
    await delay(250);
    const index = mockDb.offerings.findIndex((item) => item.id === offeringId && item.businessId === businessId);
    if (index === -1) throw new Error("Offering not found");
    const offering = mockDb.offerings[index]!;
    // Same rule as the foreign keys (ON DELETE RESTRICT) in Postgres
    if (mockDb.posOrderItems.some((item) => item.offeringId === offeringId) || mockDb.bookings.some((item) => item.offeringId === offeringId)) throw new OfferingInUseError();
    recordAudit({ businessId, action: "offering.deleted", entityId: offeringId, summary: `Deleted ${offering.type} "${offering.name}"` });
    mockDb.offerings.splice(index, 1);
    // ON DELETE CASCADE in Postgres: inclusions, stock tracking and its movements go with it
    for (const list of [mockDb.offeringInclusions, mockDb.stockItems, mockDb.stockMovements] as { offeringId: string }[][]) {
      for (let i = list.length - 1; i >= 0; i--) if (list[i]!.offeringId === offeringId) list.splice(i, 1);
    }
  },
};
