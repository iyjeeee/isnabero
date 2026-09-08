import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getCoreRepository } from "@/lib/repositories/get-repository";

// useDashboardStats: pulls the three headline numbers shown on the Dashboard (today's sales,
// upcoming bookings, active employees), scoped to the current business.
export function useDashboardStats(businessId: string | null) {
  const repository = getCoreRepository(supabase);
  return useQuery({
    queryKey: ["dashboard_stats", businessId],
    queryFn: () => repository.getDashboardStats(businessId as string),
    enabled: Boolean(businessId),
  });
}
