import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getCoreRepository } from "@/lib/repositories/get-repository";

// useBusiness: the current business row (name + whether first-run setup is finished)
export function useBusiness(businessId: string | null) {
  const repository = getCoreRepository(supabase);
  return useQuery({
    queryKey: ["business", businessId],
    queryFn: () => repository.getBusiness(businessId as string),
    enabled: Boolean(businessId),
  });
}
