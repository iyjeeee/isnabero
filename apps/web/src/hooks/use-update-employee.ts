import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getCoreRepository } from "@/lib/repositories/get-repository";
import type { UpdateEmployeeInput } from "@/lib/repositories/repository";

export function useUpdateEmployee(businessId: string) {
  const repository = getCoreRepository(supabase);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, input }: { employeeId: string; input: UpdateEmployeeInput }) =>
      repository.updateEmployee(businessId, employeeId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", businessId] });
    },
  });
}
