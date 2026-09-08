import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBookingRepository } from "./get-repository";
import type { CreateBookingInput } from "./repository";

// useBookings: lists bookings for a business within a date range — powers the calendar/day view
export function useBookings(supabase: SupabaseClient, businessId: string, from: string, to: string) {
  const repository = getBookingRepository(supabase);
  return useQuery({
    queryKey: ["bookings", businessId, from, to],
    queryFn: () => repository.listBookings(businessId, from, to),
    enabled: Boolean(businessId),
  });
}

// useCreateBooking: reserves a slot against an offering — does NOT collect payment (pair with a payment_records insert if paid upfront)
export function useCreateBooking(supabase: SupabaseClient, businessId: string) {
  const repository = getBookingRepository(supabase);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookingInput) => repository.createBooking(businessId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings", businessId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats", businessId] });
    },
  });
}
