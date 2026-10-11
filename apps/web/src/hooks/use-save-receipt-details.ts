import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getCoreRepository } from "@/lib/repositories/get-repository";
import type { ReceiptDetailsInput } from "@/lib/repositories/repository";

// useSaveReceiptDetails: saves the address/TIN/phone/footer printed on receipts; refreshes the business and any open receipt
export function useSaveReceiptDetails(businessId: string) {
  const repository = getCoreRepository(supabase);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReceiptDetailsInput) => repository.saveReceiptDetails(businessId, input),
    onSuccess: (business) => {
      queryClient.setQueryData(["business", businessId], business);
      queryClient.invalidateQueries({ queryKey: ["receipt", businessId] });
      queryClient.invalidateQueries({ queryKey: ["audit_log", businessId] });
    },
  });
}
