import type { SupabaseClient } from "@supabase/supabase-js";
import { getDataSource } from "@isnabero/db";
import type { CoreRepository } from "./repository";
import { mockCoreRepository } from "./mock-repository";
import { createSupabaseCoreRepository } from "./supabase-repository";

export function getCoreRepository(supabase: SupabaseClient): CoreRepository {
  return getDataSource() === "supabase" ? createSupabaseCoreRepository(supabase) : mockCoreRepository;
}
