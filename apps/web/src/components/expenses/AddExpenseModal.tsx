import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Textarea, Label, Select } from "@isnabero/ui";
import { EXPENSE_CATEGORY_VALUES, MAX_DESCRIPTION_LENGTH, todayYmd, useCreateExpense } from "@isnabero/module-expenses";
import { supabase } from "@/lib/supabase";
import { useLabels, useT } from "@/i18n";
import { useAuth } from "@/providers/AuthProvider";
import { expenseFormSchema, type ExpenseFormValues } from "./expense-form-schema";

interface AddExpenseModalProps {
  businessId: string;
}

const METHODS = ["cash", "gcash", "bank_transfer", "other"] as const;

const emptyValues = (): ExpenseFormValues => ({ expenseDate: todayYmd(), category: "supplies", description: "", amount: "", method: "cash", notes: "" });

export function AddExpenseModal({ businessId }: AddExpenseModalProps) {
  const { t, tm } = useT();
  const labels = useLabels();
  const [open, setOpen] = useState(false);
  const { employee } = useAuth();
  const createExpense = useCreateExpense(supabase, businessId);
  const form = useForm<ExpenseFormValues>({ resolver: zodResolver(expenseFormSchema), defaultValues: emptyValues() });
  const { errors } = form.formState;

  const handleOpenChange = (next: boolean) => {
    // Fresh form (and today's date) every time it opens
    if (next) form.reset(emptyValues());
    setOpen(next);
  };

  const onSubmit = form.handleSubmit((values) => {
    createExpense.mutate(
      {
        expenseDate: values.expenseDate,
        category: values.category,
        description: values.description,
        amount: Number(values.amount),
        method: values.method,
        notes: values.notes || null,
        recordedBy: employee?.id ?? null,
      },
      {
        onSuccess: () => {
          toast.success(t("expenses.modal.recorded"));
          setOpen(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button onClick={() => handleOpenChange(true)}>
        <Plus className="h-4 w-4" />
        {t("expenses.modal.trigger")}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("expenses.modal.title")}</DialogTitle>
          <DialogDescription>{t("expenses.modal.description")}</DialogDescription>
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={createExpense.isPending}>
              {createExpense.isPending ? t("common.saving") : t("expenses.modal.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
