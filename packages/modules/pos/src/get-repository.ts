import type { SupabaseClient } from "@supabase/supabase-js";
import { getDataSource } from "@isnabero/db";
import type { PosRepository } from "./repository";
import { mockPosRepository } from "./mock-repository";
import { createSupabasePosRepository } from "./supabase-repository";

export function getPosRepository(supabase: SupabaseClient): PosRepository {
  return getDataSource() === "supabase" ? createSupabasePosRepository(supabase) : mockPosRepository;
}
