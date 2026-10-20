import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Textarea, Label, Select } from "@isnabero/ui";
import { EXPENSE_CATEGORY_VALUES, MAX_DESCRIPTION_LENGTH, todayYmd, useCreateExpense, useUpdateExpense, type Expense } from "@isnabero/module-expenses";
import { supabase } from "@/lib/supabase";
import { useLabels, useT } from "@/i18n";
import { useAuth } from "@/providers/AuthProvider";
import { expenseFormSchema, type ExpenseFormValues } from "./expense-form-schema";

interface ExpenseFormDialogProps {
  businessId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense; // set = edit this expense; omitted = record a new one
}

const METHODS = ["cash", "gcash", "bank_transfer", "other"] as const;

const emptyValues = (): ExpenseFormValues => ({ expenseDate: todayYmd(), category: "supplies", description: "", amount: "", method: "cash", notes: "" });

const valuesOf = (expense: Expense): ExpenseFormValues => ({ expenseDate: expense.expenseDate, category: expense.category, description: expense.description, amount: String(expense.amount), method: expense.method, notes: expense.notes ?? "" });

// ExpenseFormDialog: the one form for recording a new expense and for correcting an existing one
export function ExpenseFormDialog({ businessId, open, onOpenChange, expense }: ExpenseFormDialogProps) {
  const { t, tm } = useT();
  const labels = useLabels();
  const { employee } = useAuth();
  const createExpense = useCreateExpense(supabase, businessId);
  const updateExpense = useUpdateExpense(supabase, businessId);
  const saving = createExpense.isPending || updateExpense.isPending;
  const form = useForm<ExpenseFormValues>({ resolver: zodResolver(expenseFormSchema), defaultValues: emptyValues() });
  const { errors } = form.formState;

  // Fresh form (and today's date) every time it opens; an edit starts from the saved values
  useEffect(() => {
    if (open) form.reset(expense ? valuesOf(expense) : emptyValues());
  }, [open, expense, form]);

  const onSubmit = form.handleSubmit((values) => {
    const input = {
      expenseDate: values.expenseDate,
      category: values.category,
      description: values.description,
      amount: Number(values.amount),
      method: values.method,
      notes: values.notes || null,
      recordedBy: expense?.recordedBy ?? employee?.id ?? null,
    };
    const done = (message: string) => ({
      onSuccess: () => {
        toast.success(message);
        onOpenChange(false);
      },
    });
    if (expense) updateExpense.mutate({ expenseId: expense.id, input }, done(t("expenses.modal.updated")));
    else createExpense.mutate(input, done(t("expenses.modal.recorded")));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expense ? t("expenses.modal.editTitle") : t("expenses.modal.title")}</DialogTitle>
          <DialogDescription>{expense ? t("expenses.modal.editDescription") : t("expenses.modal.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="expense-date">{t("expenses.modal.date")}</Label>
              <Input id="expense-date" type="date" max={todayYmd()} aria-invalid={Boolean(errors.expenseDate)} {...form.register("expenseDate")} />
              {errors.expenseDate && <p className="text-xs text-destructive">{tm(errors.expenseDate.message)}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-category">{t("expenses.modal.category")}</Label>
              <Select id="expense-category" {...form.register("category")}>
                {EXPENSE_CATEGORY_VALUES.map((category) => (
                  <option key={category} value={category}>
                    {labels.expenseCategory(category)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-description">{t("expenses.modal.descriptionLabel")}</Label>
            <Input
              id="expense-description"
              placeholder={t("expenses.modal.descriptionPlaceholder")}
              maxLength={MAX_DESCRIPTION_LENGTH}
              aria-invalid={Boolean(errors.description)}
              {...form.register("description")}
            />
            {errors.description && <p className="text-xs text-destructive">{tm(errors.description.message)}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="expense-amount">{t("expenses.modal.amount")}</Label>
              <Input id="expense-amount" type="number" inputMode="decimal" step="0.01" min="0" aria-invalid={Boolean(errors.amount)} {...form.register("amount")} />
              {errors.amount && <p className="text-xs text-destructive">{tm(errors.amount.message)}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-method">{t("expenses.modal.method")}</Label>
              <Select id="expense-method" {...form.register("method")}>
                {METHODS.map((method) => (
                  <option key={method} value={method}>
                    {labels.method(method)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-notes">{t("expenses.modal.notes")}</Label>
            <Textarea id="expense-notes" aria-invalid={Boolean(errors.notes)} {...form.register("notes")} />
            {errors.notes && <p className="text-xs text-destructive">{tm(errors.notes.message)}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t("common.saving") : t("expenses.modal.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
