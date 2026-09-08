import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPosRepository } from "./get-repository";
import type { CheckoutInput } from "./repository";

// useCheckout: creates the payment record, the order, and its line items in sequence — wrap in a Postgres
// function/transaction later if partial failures become a real-world problem
export function useCheckout(supabase: SupabaseClient) {
  const repository = getPosRepository(supabase);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckoutInput) => repository.checkout(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["payment_records", variables.businessId] });
      queryClient.invalidateQueries({ queryKey: ["pos_orders", variables.businessId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats", variables.businessId] });
    },
  });
}
