import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getCoreRepository } from "@/lib/repositories/get-repository";

export function useVoidPaymentRecord(businessId: string) {
  const repository = getCoreRepository(supabase);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recordId: string) => repository.voidPaymentRecord(businessId, recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_records", businessId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats", businessId] });
    },
  });
}
