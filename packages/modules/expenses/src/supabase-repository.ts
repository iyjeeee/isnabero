import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExpensesRepository } from "./repository";
import type { CreateExpenseInput, Expense, ListExpensesOptions } from "./types";
import { normalizeExpenseInput } from "./validation";

// mapExpenseRow: expenses row (snake_case from PostgREST) -> camelCase Expense
function mapExpenseRow(row: any): Expense {
  return {
    id: row.id,
    businessId: row.business_id,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    expenseDate: row.expense_date,
    method: row.method,
    notes: row.notes,
    recordedBy: row.recorded_by,
    voidedAt: row.voided_at ? new Date(row.voided_at) : null,
    createdAt: new Date(row.created_at),
  };
}

export function createSupabaseExpensesRepository(supabase: SupabaseClient): ExpensesRepository {
  return {
    async listExpenses(businessId, options?: ListExpensesOptions) {
      let query = supabase.from("expenses").select("*").eq("business_id", businessId);
      if (!options?.includeVoided) query = query.is("voided_at", null);
      const { data, error } = await query.order("expense_date", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapExpenseRow);
    },

    async createExpense(businessId, input: CreateExpenseInput) {
      const clean = normalizeExpenseInput(input);
      const { data, error } = await supabase
        .from("expenses")
        .insert({
          business_id: businessId,
          category: clean.category,
          description: clean.description,
          amount: clean.amount,
          expense_date: clean.expenseDate,
          method: clean.method,
          notes: clean.notes,
          recorded_by: clean.recordedBy,
        })
        .select()
        .single();
      if (error) throw error;
      return mapExpenseRow(data);
    },

    async updateExpense(businessId, expenseId, input: CreateExpenseInput) {
      const clean = normalizeExpenseInput(input);
      const { data, error } = await supabase
        .from("expenses")
        .update({ category: clean.category, description: clean.description, amount: clean.amount, expense_date: clean.expenseDate, method: clean.method, notes: clean.notes })
        .eq("id", expenseId)
        .eq("business_id", businessId)
        .is("voided_at", null)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("This expense can't be edited — it was voided or no longer exists.");
      return mapExpenseRow(data);
    },

    async voidExpense(businessId, expenseId) {
      // Only touches still-active rows so a repeat void keeps the original void time
      const { data, error } = await supabase
        .from("expenses")
        .update({ voided_at: new Date().toISOString() })
        .eq("id", expenseId)
        .eq("business_id", businessId)
        .is("voided_at", null)
        .select("id");
      if (error) throw error;
      if ((data ?? []).length > 0) return;
      // Nothing updated: either already voided (fine) or it doesn't exist (error)
      const { data: existing, error: lookupError } = await supabase.from("expenses").select("id").eq("id", expenseId).eq("business_id", businessId).maybeSingle();
      if (lookupError) throw lookupError;
      if (!existing) throw new Error("Expense not found");
    },
  };
}
