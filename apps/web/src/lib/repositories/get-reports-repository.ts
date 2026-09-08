import type { SupabaseClient } from "@supabase/supabase-js";
import { getDataSource } from "@isnabero/db";
import type { ReportsRepository } from "./reports-repository";
import { mockReportsRepository } from "./mock-reports-repository";
import { createSupabaseReportsRepository } from "./supabase-reports-repository";

export function getReportsRepository(supabase: SupabaseClient): ReportsRepository {
  return getDataSource() === "supabase" ? createSupabaseReportsRepository(supabase) : mockReportsRepository;
}
