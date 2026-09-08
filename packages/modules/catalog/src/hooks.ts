import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCatalogRepository } from "./get-repository";
import type { CreateOfferingInput } from "./repository";

// useOfferings: lists all offerings for a business, inclusions nested per-offering for bundle rendering
export function useOfferings(supabase: SupabaseClient, businessId: string) {
  const repository = getCatalogRepository(supabase);
  return useQuery({
    queryKey: ["offerings", businessId],
    queryFn: () => repository.listOfferings(businessId),
    enabled: Boolean(businessId),
  });
}

// useCreateOfferingWithInclusions: writes the offering and its bundle inclusion rows together — used by
// the Catalog "Add offering" form so bundles don't need a second manual step
export function useCreateOfferingWithInclusions(supabase: SupabaseClient, businessId: string) {
  const repository = getCatalogRepository(supabase);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOfferingInput) => repository.createOfferingWithInclusions(businessId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offerings", businessId] });
    },
  });
}

// useToggleOfferingAvailability: quick sold-out / available toggle, the lightweight stand-in for full inventory
export function useToggleOfferingAvailability(supabase: SupabaseClient, businessId: string) {
  const repository = getCatalogRepository(supabase);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ offeringId, isAvailable }: { offeringId: string; isAvailable: boolean }) =>
      repository.toggleAvailability(offeringId, isAvailable),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offerings", businessId] });
    },
  });
}
