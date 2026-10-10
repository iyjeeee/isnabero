import { z } from "zod";
import { EXPENSE_CATEGORY_VALUES, MAX_DESCRIPTION_LENGTH, MAX_EXPENSE_AMOUNT, MAX_NOTES_LENGTH, todayYmd } from "@isnabero/module-expenses";

// The amount stays a string in the form: z.coerce.number() would turn a blank input into 0 (see offering-form-schema.ts).
// The modal converts it with Number() after validation; the repository re-validates everything on save.
export const expenseFormSchema = z.object({
  expenseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
    .refine((value) => value <= todayYmd(), "The date can't be in the future"),
  category: z.enum(EXPENSE_CATEGORY_VALUES),
  description: z.string().trim().min(1, "Description is required").max(MAX_DESCRIPTION_LENGTH, `Keep it under ${MAX_DESCRIPTION_LENGTH} characters`),
  amount: z
    .string()
    .trim()
    .min(1, "Amount is required")
    .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0.01, "Amount must be at least ₱0.01")
    .refine((value) => Number(value) <= MAX_EXPENSE_AMOUNT, "Amount is too large"),
  method: z.enum(["cash", "gcash", "bank_transfer", "other"]),
  notes: z.string().trim().max(MAX_NOTES_LENGTH, `Keep it under ${MAX_NOTES_LENGTH} characters`).optional(),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;
