import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingRepository, CreateBookingInput } from "./repository";
import type { BookingWithOffering } from "./types";

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
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          business_id: businessId,
          offering_id: input.offeringId,
          mode: input.mode ?? "appointment",
          customer_name: input.customerName,
          customer_contact: input.customerContact ?? null,
          start_time: input.startTime,
          end_time: input.endTime,
          status: "pending",
          payment_record_id: input.paymentRecordId ?? null,
        })
        .select("*, offering:offerings(*, inclusions:offering_inclusions(*))")
        .single();
      if (error) throw error;
      return mapBookingRow(data);
    },
  };
}
