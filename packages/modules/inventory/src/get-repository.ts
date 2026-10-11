import type { SupabaseClient } from "@supabase/supabase-js";
import { getDataSource } from "@isnabero/db";
import type { InventoryRepository } from "./repository";
import { mockInventoryRepository } from "./mock-repository";
import { createSupabaseInventoryRepository } from "./supabase-repository";

export function getInventoryRepository(supabase: SupabaseClient): InventoryRepository {
  return getDataSource() === "supabase" ? createSupabaseInventoryRepository(supabase) : mockInventoryRepository;
}
