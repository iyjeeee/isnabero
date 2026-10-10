import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingRepository, CreateBookingInput } from "./repository";
import type { BookingWithOffering } from "./types";
import { BookingConflictError, assertValidRange } from "./overlap";

function mapOfferingRow(row: any) {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    description: row.description,
    type: row.type,
    price: row.price,
    durationMinutes: row.duration_minutes,
    isAvailable: row.is_available,
    createdAt: new Date(row.created_at),
    inclusions: (row.inclusions ?? []).map((inclusion: any) => ({
      id: inclusion.id,
      offeringId: inclusion.offering_id,
      label: inclusion.label,
      quantity: inclusion.quantity,
    })),
  };
}

function mapBookingRow(row: any): BookingWithOffering {
  return {
    id: row.id,
    businessId: row.business_id,
    offeringId: row.offering_id,
    mode: row.mode,
    customerName: row.customer_name,
    customerContact: row.customer_contact,
    startTime: new Date(row.start_time),
    endTime: new Date(row.end_time),
    status: row.status,
    paymentRecordId: row.payment_record_id,
    createdAt: new Date(row.created_at),
    offering: mapOfferingRow(row.offering),
  };
}

export function createSupabaseBookingRepository(supabase: SupabaseClient): BookingRepository {
  return {
    async listBookings(businessId, from, to) {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, offering:offerings(*, inclusions:offering_inclusions(*))")
        .eq("business_id", businessId)
        .gte("start_time", from)
        .lte("start_time", to)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapBookingRow);
    },

    async createBooking(businessId, input: CreateBookingInput) {
      const range = { startTime: new Date(input.startTime as unknown as string | Date), endTime: new Date(input.endTime as unknown as string | Date) };
      assertValidRange(range);

      // Pre-check for a friendly error naming the clashing booking; the DB exclusion constraint
      // (migration 0003) is the real guarantee against two requests racing for the same slot.
      const { data: clashes, error: clashError } = await supabase
        .from("bookings")
        .select("customer_name, start_time, end_time")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .lt("start_time", range.endTime.toISOString())
        .gt("end_time", range.startTime.toISOString())
        .limit(1);
      if (clashError) throw clashError;
      const clash = clashes?.[0];
      if (clash) {
        throw new BookingConflictError({ customerName: clash.customer_name, startTime: new Date(clash.start_time), endTime: new Date(clash.end_time) });
      }

      const { data, error } = await supabase
        .from("bookings")
        .insert({
          business_id: businessId,
          offering_id: input.offeringId,
          mode: input.mode ?? "appointment",
          customer_name: input.customerName,
          customer_contact: input.customerContact ?? null,
          start_time: range.startTime.toISOString(),
          end_time: range.endTime.toISOString(),
          status: "pending",
          payment_record_id: input.paymentRecordId ?? null,
        })
        .select("*, offering:offerings(*, inclusions:offering_inclusions(*))")
        .single();
      if (error) throw error.code === "23P01" ? new BookingConflictError() : error; // 23P01 = exclusion_violation
      return mapBookingRow(data);
    },
  };
}
