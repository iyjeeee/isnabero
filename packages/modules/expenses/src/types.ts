import type { paymentMethodEnum } from "@isnabero/db";
import type { ExpenseCategory } from "./categories";

export type ExpensePaymentMethod = (typeof paymentMethodEnum.enumValues)[number];

// Expense: what the UI renders (amount as a number, expenseDate as a YYYY-MM-DD calendar day)
export interface Expense {
  id: string;
  businessId: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: string;
  method: ExpensePaymentMethod;
  notes: string | null;
  recordedBy: string | null; // employee id of whoever entered it
  voidedAt: Date | null; // null = active
  createdAt: Date;
}

export interface CreateExpenseInput {
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: string; // YYYY-MM-DD, not in the future
  method: ExpensePaymentMethod;
  notes: string | null;
  recordedBy: string | null;
}

export interface ListExpensesOptions {
  includeVoided?: boolean;
}
