import type { BreakdownSlice } from "@/lib/repositories/reports-repository";

export interface ProfitPayment {
  amount: number | string;
  createdAt: Date;
  voidedAt: Date | null;
}
export interface ProfitExpense {
  amount: number | string;
  expenseDate: string; // YYYY-MM-DD
  category: string;
  voidedAt: Date | null;
}
export interface ProfitWindow {
  start: Date; // inclusive
  end: Date | null; // exclusive; null = up to now
}

const toKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const round = (value: number) => Math.round(value * 100) / 100;

// sumWindow: revenue (non-voided payments by time) and expenses (non-voided, by the day they were paid) inside one window
export function sumWindow(payments: ProfitPayment[], expenses: ProfitExpense[], window: ProfitWindow) {
  const startKey = toKey(window.start);
  const endKey = window.end ? toKey(window.end) : null;
  const revenue = payments
    .filter((payment) => !payment.voidedAt && payment.createdAt >= window.start && (!window.end || payment.createdAt < window.end))
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const spent = expenses.filter((expense) => !expense.voidedAt && expense.expenseDate >= startKey && (endKey === null || expense.expenseDate < endKey));
  const byCategory = new Map<string, number>();
  for (const expense of spent) byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + Number(expense.amount));
  const total = spent.reduce((sum, expense) => sum + Number(expense.amount), 0);
  return { revenue: round(revenue), expenses: round(total), profit: round(revenue - total), byCategory };
}

export interface ProfitReportData {
  revenue: number;
  expenses: number;
  profit: number;
  previousProfit: number; // same-length window just before, for the trend
  expensesByCategory: BreakdownSlice[]; // biggest first
}

// buildProfitReport: current vs previous window — profit = revenue (all payment methods) - expenses
export function buildProfitReport(payments: ProfitPayment[], expenses: ProfitExpense[], current: ProfitWindow, previous: ProfitWindow): ProfitReportData {
  const now = sumWindow(payments, expenses, current);
  const before = sumWindow(payments, expenses, previous);
  return {
    revenue: now.revenue,
    expenses: now.expenses,
    profit: now.profit,
    previousProfit: before.profit,
    expensesByCategory: [...now.byCategory.entries()].map(([label, value]) => ({ label, value: round(value) })).sort((a, b) => b.value - a.value),
  };
}
