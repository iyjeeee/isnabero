import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPosRepository } from "./get-repository";
import type { CheckoutInput } from "./repository";
import { receiptRefKey, type ReceiptRef } from "./receipt";

// useCheckout: records the sale (payment record, order, items) and takes tracked items out of stock — all or nothing
// (mock: validated up front; Supabase: one checkout_sale() transaction). On success or failure the stock counts are
// refetched, since a rejected sale usually means someone else changed them.
export function useCheckout(supabase: SupabaseClient) {
  const repository = getPosRepository(supabase);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckoutInput) => repository.checkout(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["payment_records", variables.businessId] });
      queryClient.invalidateQueries({ queryKey: ["pos_orders", variables.businessId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats", variables.businessId] });
      queryClient.invalidateQueries({ queryKey: ["stock", variables.businessId] });
    },
    onError: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["stock", variables.businessId] });
    },
  });
}

// useReceipt: the printable receipt for a sale (by order id or payment record id); null when there is no POS sale for it
export function useReceipt(supabase: SupabaseClient, businessId: string, ref: ReceiptRef | null) {
  const repository = getPosRepository(supabase);
  return useQuery({
    queryKey: ["receipt", businessId, ref ? receiptRefKey(ref) : null],
    queryFn: () => repository.getReceipt(businessId, ref as ReceiptRef),
    enabled: Boolean(businessId) && ref !== null,
  });
}
