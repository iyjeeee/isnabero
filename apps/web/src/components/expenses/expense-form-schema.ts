import { z } from "zod";
import { msg } from "@/i18n";
import { EXPENSE_CATEGORY_VALUES, MAX_DESCRIPTION_LENGTH, MAX_EXPENSE_AMOUNT, MAX_NOTES_LENGTH, todayYmd } from "@isnabero/module-expenses";

// The amount stays a string in the form: z.coerce.number() would turn a blank input into 0 (see offering-form-schema.ts).
// The modal converts it with Number() after validation; the repository re-validates everything on save.
export const expenseFormSchema = z.object({
  expenseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, msg("expenses.form.chooseDate"))
    .refine((value) => value <= todayYmd(), msg("expenses.form.futureDate")),
  category: z.enum(EXPENSE_CATEGORY_VALUES),
  description: z.string().trim().min(1, msg("expenses.form.descriptionRequired")).max(MAX_DESCRIPTION_LENGTH, msg("expenses.form.keepUnder", { max: MAX_DESCRIPTION_LENGTH })),
  amount: z
    .string()
    .trim()
    .min(1, msg("expenses.form.amountRequired"))
    .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0.01, msg("expenses.form.amountMin"))
    .refine((value) => Number(value) <= MAX_EXPENSE_AMOUNT, msg("expenses.form.amountTooLarge")),
  method: z.enum(["cash", "gcash", "bank_transfer", "other"]),
  notes: z.string().trim().max(MAX_NOTES_LENGTH, msg("expenses.form.keepUnder", { max: MAX_NOTES_LENGTH })).optional(),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;
