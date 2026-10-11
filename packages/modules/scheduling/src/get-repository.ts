import type { SupabaseClient } from "@supabase/supabase-js";
import { getDataSource } from "@isnabero/db";
import type { SchedulingRepository } from "./repository";
import { mockSchedulingRepository } from "./mock-repository";
import { createSupabaseSchedulingRepository } from "./supabase-repository";

export function getSchedulingRepository(supabase: SupabaseClient): SchedulingRepository {
  return getDataSource() === "supabase" ? createSupabaseSchedulingRepository(supabase) : mockSchedulingRepository;
}
