import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getCoreRepository } from "@/lib/repositories/get-repository";

export function useDeleteEmployee(businessId: string) {
  const repository = getCoreRepository(supabase);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (employeeId: string) => repository.deleteEmployee(businessId, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", businessId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats", businessId] });
    },
  });
}
