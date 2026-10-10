import type { Expense, ExpenseCategory } from "@isnabero/module-expenses";

export interface ExpenseStats {
  monthTotal: number;
  allTimeTotal: number;
  topCategory: { category: ExpenseCategory; total: number } | null; // biggest category this month
}

// computeExpenseStats: totals over active (non-voided) expenses only; "this month" = the month of `today` (YYYY-MM-DD)
export function computeExpenseStats(expenses: Expense[], today: string): ExpenseStats {
  const month = today.slice(0, 7);
  let monthTotal = 0;
  let allTimeTotal = 0;
  const byCategory = new Map<ExpenseCategory, number>();
  for (const expense of expenses) {
    if (expense.voidedAt) continue;
    allTimeTotal += expense.amount;
    if (expense.expenseDate.slice(0, 7) !== month) continue;
    monthTotal += expense.amount;
    byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + expense.amount);
  }
  let topCategory: ExpenseStats["topCategory"] = null;
  for (const [category, total] of byCategory) if (!topCategory || total > topCategory.total) topCategory = { category, total };
  return { monthTotal: Math.round(monthTotal * 100) / 100, allTimeTotal: Math.round(allTimeTotal * 100) / 100, topCategory };
}
