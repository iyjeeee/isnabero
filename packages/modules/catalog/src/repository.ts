import type { NewOffering, OfferingWithInclusions } from "./types";

export interface CreateOfferingInput {
  offering: Omit<NewOffering, "businessId" | "id" | "createdAt">;
  inclusions: { label: string; quantity: number | null }[];
}

// CatalogRepository: data-access contract for the Catalog module. Hooks call this interface instead of
// Supabase/mock storage directly, so swapping VITE_DATA_SOURCE never touches component or hook code.
export interface CatalogRepository {
  listOfferings(businessId: string): Promise<OfferingWithInclusions[]>;
  createOfferingWithInclusions(businessId: string, input: CreateOfferingInput): Promise<OfferingWithInclusions>;
  toggleAvailability(offeringId: string, isAvailable: boolean): Promise<void>;
  // updateOffering: edits the details and replaces the inclusions (bundles only) in one go; availability has its own toggle
  updateOffering(businessId: string, offeringId: string, input: CreateOfferingInput): Promise<OfferingWithInclusions>;
  // deleteOffering: throws OfferingInUseError when sales or bookings reference it (mark it sold out instead)
  deleteOffering(businessId: string, offeringId: string): Promise<void>;
}
