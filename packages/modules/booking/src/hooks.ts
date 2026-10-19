import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBookingRepository } from "./get-repository";
import type { CreateBookingInput, UpdateBookingInput } from "./repository";
import type { BookingStatus } from "./status";

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

// refreshBookings: every list that shows bookings (calendar, dashboard count, reports)
function refreshBookings(queryClient: ReturnType<typeof useQueryClient>, businessId: string) {
  queryClient.invalidateQueries({ queryKey: ["bookings", businessId] });
  queryClient.invalidateQueries({ queryKey: ["dashboard_stats", businessId] });
  queryClient.invalidateQueries({ queryKey: ["reports"] });
}

// useUpdateBooking: edit an open booking's package, customer or time
export function useUpdateBooking(supabase: SupabaseClient, businessId: string) {
  const repository = getBookingRepository(supabase);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, input }: { bookingId: string; input: UpdateBookingInput }) => repository.updateBooking(businessId, bookingId, input),
    onSuccess: () => refreshBookings(queryClient, businessId),
  });
}

// useUpdateBookingStatus: confirm, complete or cancel a booking
export function useUpdateBookingStatus(supabase: SupabaseClient, businessId: string) {
  const repository = getBookingRepository(supabase);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, status }: { bookingId: string; status: BookingStatus }) => repository.updateBookingStatus(businessId, bookingId, status),
    onSuccess: () => refreshBookings(queryClient, businessId),
  });
}
