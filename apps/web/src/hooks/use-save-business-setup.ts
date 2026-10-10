import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getCoreRepository } from "@/lib/repositories/get-repository";
import type { SaveBusinessSetupInput } from "@/lib/repositories/repository";
import { useBusinessStore } from "@/stores/business-store";

// useSaveBusinessSetup: setup wizard save. Caches the fresh business row and waits for the module list to refetch
// before resolving, so navigating away right after never shows the old sidebar or bounces back into the wizard.
export function useSaveBusinessSetup(businessId: string) {
  const repository = getCoreRepository(supabase);
  const queryClient = useQueryClient();
  const setBusiness = useBusinessStore((state) => state.setBusiness);
  return useMutation({
    mutationFn: (input: SaveBusinessSetupInput) => repository.saveBusinessSetup(businessId, input),
    onSuccess: async (business) => {
      queryClient.setQueryData(["business", businessId], business);
      setBusiness(business.id, business.name);
      await queryClient.invalidateQueries({ queryKey: ["business_modules", businessId] });
    },
  });
}
