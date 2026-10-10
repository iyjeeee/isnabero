import { paymentMethodEnum } from "@isnabero/db";
import { EXPENSE_CATEGORY_VALUES } from "./categories";
import type { CreateExpenseInput } from "./types";

export const MAX_DESCRIPTION_LENGTH = 120;
export const MAX_NOTES_LENGTH = 500;
export const MAX_EXPENSE_AMOUNT = 9_999_999.99;

// todayYmd: today's calendar day in the local timezone (YYYY-MM-DD) — what a date input holds and what "future" is measured against
export function todayYmd(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// isRealDate: format check plus a real-calendar check (rejects 2026-02-31)
function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

// normalizeExpenseInput: the data-integrity guard shared by the mock and Supabase repositories. Returns the cleaned
// input (trimmed text, amount rounded to cents) or throws an Error with a user-facing message.
export function normalizeExpenseInput(input: CreateExpenseInput, today = todayYmd()): CreateExpenseInput {
  if (!EXPENSE_CATEGORY_VALUES.includes(input.category)) throw new Error("Choose a valid expense category.");
  if (!(paymentMethodEnum.enumValues as readonly string[]).includes(input.method)) throw new Error("Choose a valid payment method.");

  const description = input.description.trim();
  if (!description) throw new Error("Description is required.");
  if (description.length > MAX_DESCRIPTION_LENGTH) throw new Error(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`);

  const notes = input.notes?.trim() || null;
  if (notes && notes.length > MAX_NOTES_LENGTH) throw new Error(`Notes must be ${MAX_NOTES_LENGTH} characters or fewer.`);

  if (!Number.isFinite(input.amount)) throw new Error("Enter a valid amount.");
  const amount = Math.round(input.amount * 100) / 100;
  if (amount < 0.01) throw new Error("Amount must be at least ₱0.01.");
  if (amount > MAX_EXPENSE_AMOUNT) throw new Error("Amount is too large.");

  if (!isRealDate(input.expenseDate)) throw new Error("Enter a valid date.");
  if (input.expenseDate > today) throw new Error("The expense date can't be in the future.");

  return { ...input, description, notes, amount };
}
