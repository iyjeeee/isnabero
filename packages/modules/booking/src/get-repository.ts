import type { SupabaseClient } from "@supabase/supabase-js";
import { getDataSource } from "@isnabero/db";
import type { BookingRepository } from "./repository";
import { mockBookingRepository } from "./mock-repository";
import { createSupabaseBookingRepository } from "./supabase-repository";

export function getBookingRepository(supabase: SupabaseClient): BookingRepository {
  return getDataSource() === "supabase" ? createSupabaseBookingRepository(supabase) : mockBookingRepository;
}
