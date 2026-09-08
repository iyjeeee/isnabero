import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getCoreRepository } from "@/lib/repositories/get-repository";
import type { CreateEmployeeInput } from "@/lib/repositories/repository";

export function useCreateEmployee(businessId: string) {
  const repository = getCoreRepository(supabase);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) => repository.createEmployee(businessId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", businessId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats", businessId] });
    },
  });
}
