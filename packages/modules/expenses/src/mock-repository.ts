import { mockDb, delay, genId, recordAudit, auditPeso } from "@isnabero/db";
import type { ExpensesRepository } from "./repository";
import type { CreateExpenseInput, Expense, ListExpensesOptions } from "./types";
import { normalizeExpenseInput } from "./validation";

function toExpense(row: (typeof mockDb.expenses)[number]): Expense {
  return {
    id: row.id,
    businessId: row.businessId,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    expenseDate: row.expenseDate,
    method: row.method,
    notes: row.notes,
    recordedBy: row.recordedBy,
    voidedAt: row.voidedAt,
    createdAt: row.createdAt,
  };
}

export const mockExpensesRepository: ExpensesRepository = {
  async listExpenses(businessId, options?: ListExpensesOptions) {
    await delay();
    return mockDb.expenses
      .filter((row) => row.businessId === businessId)
      .filter((row) => options?.includeVoided || !row.voidedAt)
      .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.createdAt.getTime() - a.createdAt.getTime())
      .map(toExpense);
  },

  async createExpense(businessId, input: CreateExpenseInput) {
    await delay(300);
    const clean = normalizeExpenseInput(input);
    const row = {
      id: genId(),
      businessId,
      category: clean.category,
      description: clean.description,
      amount: clean.amount.toFixed(2),
      expenseDate: clean.expenseDate,
      method: clean.method,
      notes: clean.notes,
      recordedBy: clean.recordedBy,
      voidedAt: null,
      createdAt: new Date(),
    };
    mockDb.expenses.push(row);
    recordAudit({ businessId, action: "expense.created", entityId: row.id, summary: `Recorded expense "${row.description}" ${auditPeso(row.amount)} (${row.category})` });
    return toExpense(row);
  },

  async voidExpense(businessId, expenseId) {
    await delay(250);
    const row = mockDb.expenses.find((item) => item.id === expenseId && item.businessId === businessId);
    if (!row) throw new Error("Expense not found");
    if (!row.voidedAt) {
      row.voidedAt = new Date();
      recordAudit({ businessId, action: "expense.voided", entityId: row.id, summary: `Voided expense "${row.description}" ${auditPeso(row.amount)}` });
    }
  },
};
