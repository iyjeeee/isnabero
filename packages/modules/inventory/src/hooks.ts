import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getInventoryRepository } from "./get-repository";
import type { AdjustStockInput, ListMovementsOptions, StartTrackingInput } from "./types";

// useStockLevels: tracked offerings with their counts. POS reads this too, so selling invalidates it (see POS hooks).
export function useStockLevels(supabase: SupabaseClient, businessId: string) {
  const repository = getInventoryRepository(supabase);
  return useQuery({
    queryKey: ["stock", businessId, "levels"],
    queryFn: () => repository.listStockLevels(businessId),
    enabled: Boolean(businessId),
  });
}

export function useStockMovements(supabase: SupabaseClient, businessId: string, options?: ListMovementsOptions) {
  const repository = getInventoryRepository(supabase);
  return useQuery({
    queryKey: ["stock", businessId, "movements", options?.offeringId ?? "all"],
    queryFn: () => repository.listMovements(businessId, options),
    enabled: Boolean(businessId),
  });
}

// Every inventory mutation refreshes all stock queries for the business (levels + history)
function useStockMutation<TInput>(businessId: string, run: (input: TInput) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stock", businessId] }),
  });
}

export function useStartTracking(supabase: SupabaseClient, businessId: string) {
  const repository = getInventoryRepository(supabase);
  return useStockMutation<StartTrackingInput>(businessId, (input) => repository.startTracking(businessId, input));
}

export function useStopTracking(supabase: SupabaseClient, businessId: string) {
  const repository = getInventoryRepository(supabase);
  return useStockMutation<string>(businessId, (offeringId) => repository.stopTracking(businessId, offeringId));
}

export function useSetLowStockThreshold(supabase: SupabaseClient, businessId: string) {
  const repository = getInventoryRepository(supabase);
  return useStockMutation<{ offeringId: string; threshold: number }>(businessId, ({ offeringId, threshold }) =>
    repository.setLowStockThreshold(businessId, offeringId, threshold),
  );
}

export function useAdjustStock(supabase: SupabaseClient, businessId: string) {
  const repository = getInventoryRepository(supabase);
  return useStockMutation<AdjustStockInput>(businessId, (input) => repository.adjustStock(businessId, input));
}
