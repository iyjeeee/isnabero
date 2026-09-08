import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogRepository, CreateOfferingInput } from "./repository";
import type { OfferingWithInclusions } from "./types";

// mapInclusionRow: offering_inclusions row (snake_case, as returned by PostgREST) -> camelCase type
function mapInclusionRow(row: any) {
  return { id: row.id, offeringId: row.offering_id, label: row.label, quantity: row.quantity };
}

// mapOfferingRow: offerings row (snake_case) -> camelCase type, with nested inclusions mapped the same way.
// This mapping step was missing before — the previous code cast the raw snake_case response directly to
// the camelCase type, which would have silently produced `undefined` for isAvailable/durationMinutes/etc.
function mapOfferingRow(row: any): OfferingWithInclusions {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    description: row.description,
    type: row.type,
    price: row.price,
    durationMinutes: row.duration_minutes,
    isAvailable: row.is_available,
    createdAt: new Date(row.created_at),
    inclusions: (row.inclusions ?? []).map(mapInclusionRow),
  };
}

export function createSupabaseCatalogRepository(supabase: SupabaseClient): CatalogRepository {
  return {
    async listOfferings(businessId) {
      const { data, error } = await supabase
        .from("offerings")
        .select("*, inclusions:offering_inclusions(*)")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapOfferingRow);
    },

    async createOfferingWithInclusions(businessId, input: CreateOfferingInput) {
      const { data: offeringRow, error: offeringError } = await supabase
        .from("offerings")
        .insert({
          business_id: businessId,
          name: input.offering.name,
          description: input.offering.description ?? null,
          type: input.offering.type ?? "item",
          price: input.offering.price,
          duration_minutes: input.offering.durationMinutes ?? null,
          is_available: input.offering.isAvailable ?? true,
        })
        .select()
        .single();
      if (offeringError) throw offeringError;

      let inclusionRows: any[] = [];
      if (input.inclusions.length > 0) {
        const { data, error: inclusionsError } = await supabase
          .from("offering_inclusions")
          .insert(
            input.inclusions.map((inclusion) => ({
              offering_id: offeringRow.id,
              label: inclusion.label,
              quantity: inclusion.quantity,
            })),
          )
          .select();
        if (inclusionsError) throw inclusionsError;
        inclusionRows = data ?? [];
      }

      return mapOfferingRow({ ...offeringRow, inclusions: inclusionRows });
    },

    async toggleAvailability(offeringId, isAvailable) {
      const { error } = await supabase.from("offerings").update({ is_available: isAvailable }).eq("id", offeringId);
      if (error) throw error;
    },
  };
}
