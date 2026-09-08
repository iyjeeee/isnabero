import type { SupabaseClient } from "@supabase/supabase-js";
import { getDataSource } from "@isnabero/db";
import type { CatalogRepository } from "./repository";
import { mockCatalogRepository } from "./mock-repository";
import { createSupabaseCatalogRepository } from "./supabase-repository";

// getCatalogRepository: picks the active data source once per call — cheap enough to call inside hooks
export function getCatalogRepository(supabase: SupabaseClient): CatalogRepository {
  return getDataSource() === "supabase" ? createSupabaseCatalogRepository(supabase) : mockCatalogRepository;
}
