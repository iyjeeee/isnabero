import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getCoreRepository } from "@/lib/repositories/get-repository";
import type { CloseCashInput } from "@/lib/repositories/repository";

// startOfToday: midnight on this device — where the very first close starts counting
export function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

// useCashCloseSummary: cash in and out since the last close; always refetched on open so the numbers are current
export function useCashCloseSummary(businessId: string) {
  const repository = getCoreRepository(supabase);
  return useQuery({
    queryKey: ["cash_close_summary", businessId],
    queryFn: () => repository.getCashCloseSummary(businessId, startOfToday()),
    enabled: Boolean(businessId),
    refetchOnMount: "always",
  });
}

export function useCashCloses(businessId: string) {
  const repository = getCoreRepository(supabase);
  return useQuery({ queryKey: ["cash_closes", businessId], queryFn: () => repository.listCashCloses(businessId), enabled: Boolean(businessId), refetchOnMount: "always" });
}

export function useCloseCash(businessId: string) {
  const repository = getCoreRepository(supabase);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CloseCashInput) => repository.closeCash(businessId, startOfToday(), input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash_close_summary", businessId] });
      queryClient.invalidateQueries({ queryKey: ["cash_closes", businessId] });
      queryClient.invalidateQueries({ queryKey: ["audit_log", businessId] });
    },
  });
}
