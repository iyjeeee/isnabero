import type { CreateExpenseInput, Expense, ListExpensesOptions } from "./types";

// ExpensesRepository: data-access contract for the Expenses module.
// Intentionally NO update/delete: an expense is financial history, so a mistake is voided (excluded from totals, kept
// for the audit trail) and re-entered — same rule as payment records.
export interface ExpensesRepository {
  // listExpenses: newest expense date first; voided ones only with includeVoided
  listExpenses(businessId: string, options?: ListExpensesOptions): Promise<Expense[]>;
  // createExpense: validates with normalizeExpenseInput and throws a user-facing Error if the input is bad
  createExpense(businessId: string, input: CreateExpenseInput): Promise<Expense>;
  // voidExpense: idempotent (voiding twice keeps the first void time); throws if the expense doesn't exist
  voidExpense(businessId: string, expenseId: string): Promise<void>;
}
