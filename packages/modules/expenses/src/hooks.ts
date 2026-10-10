import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getExpensesRepository } from "./get-repository";
import type { CreateExpenseInput, ListExpensesOptions } from "./types";

// useExpenses: expenses for a business, newest first; pass includeVoided to also get voided ones
export function useExpenses(supabase: SupabaseClient, businessId: string, options?: ListExpensesOptions) {
  const repository = getExpensesRepository(supabase);
  const includeVoided = Boolean(options?.includeVoided);
  return useQuery({
    queryKey: ["expenses", businessId, includeVoided],
    queryFn: () => repository.listExpenses(businessId, { includeVoided }),
    enabled: Boolean(businessId),
  });
}

export function useCreateExpense(supabase: SupabaseClient, businessId: string) {
  const repository = getExpensesRepository(supabase);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExpenseInput) => repository.createExpense(businessId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses", businessId] }),
  });
}

export function useVoidExpense(supabase: SupabaseClient, businessId: string) {
  const repository = getExpensesRepository(supabase);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => repository.voidExpense(businessId, expenseId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses", businessId] }),
  });
}
