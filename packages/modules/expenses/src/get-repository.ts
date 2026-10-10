import type { SupabaseClient } from "@supabase/supabase-js";
import { getDataSource } from "@isnabero/db";
import type { ExpensesRepository } from "./repository";
import { mockExpensesRepository } from "./mock-repository";
import { createSupabaseExpensesRepository } from "./supabase-repository";

export function getExpensesRepository(supabase: SupabaseClient): ExpensesRepository {
  return getDataSource() === "supabase" ? createSupabaseExpensesRepository(supabase) : mockExpensesRepository;
}
