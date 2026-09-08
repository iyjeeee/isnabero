import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getCoreRepository } from "@/lib/repositories/get-repository";

// useBusinessModules: returns the set of module_keys with enabled=true for this business.
// The sidebar cross-references this against MODULE_REGISTRY to decide what to render.
export function useBusinessModules(businessId: string | null) {
  const repository = getCoreRepository(supabase);
  return useQuery({
    queryKey: ["business_modules", businessId],
    queryFn: () => repository.listEnabledModules(businessId as string),
    enabled: Boolean(businessId),
  });
}
