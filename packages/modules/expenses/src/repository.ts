import type { CreateExpenseInput, Expense, ListExpensesOptions } from "./types";

// ExpensesRepository: data-access contract for the Expenses module.
// Intentionally NO delete: an expense is financial history. A mistake can be corrected (updateExpense, every change is
// audited) or voided (excluded from totals, kept for the audit trail) — never erased. Voided expenses are frozen.
export interface ExpensesRepository {
  // listExpenses: newest expense date first; voided ones only with includeVoided
  listExpenses(businessId: string, options?: ListExpensesOptions): Promise<Expense[]>;
  // createExpense: validates with normalizeExpenseInput and throws a user-facing Error if the input is bad
  createExpense(businessId: string, input: CreateExpenseInput): Promise<Expense>;
  // updateExpense: corrects an active expense (same validation as create; who recorded it and when never change). Throws if it is voided or missing.
  updateExpense(businessId: string, expenseId: string, input: CreateExpenseInput): Promise<Expense>;
  // voidExpense: idempotent (voiding twice keeps the first void time); throws if the expense doesn't exist
  voidExpense(businessId: string, expenseId: string): Promise<void>;
}
