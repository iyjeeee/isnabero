import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Textarea, Label, Select } from "@isnabero/ui";
import { EXPENSE_CATEGORIES, MAX_DESCRIPTION_LENGTH, todayYmd, useCreateExpense } from "@isnabero/module-expenses";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { expenseFormSchema, type ExpenseFormValues } from "./expense-form-schema";

interface AddExpenseModalProps {
  businessId: string;
}

const emptyValues = (): ExpenseFormValues => ({ expenseDate: todayYmd(), category: "supplies", description: "", amount: "", method: "cash", notes: "" });

export function AddExpenseModal({ businessId }: AddExpenseModalProps) {
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
          toast.success("Expense recorded");
          setOpen(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button onClick={() => handleOpenChange(true)}>
        <Plus className="h-4 w-4" />
        Add expense
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
          <DialogDescription>Record money your business spent. Mistakes can be voided, not edited.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="expense-date">Date</Label>
              <Input id="expense-date" type="date" max={todayYmd()} aria-invalid={Boolean(errors.expenseDate)} {...form.register("expenseDate")} />
              {errors.expenseDate && <p className="text-xs text-destructive">{errors.expenseDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-category">Category</Label>
              <Select id="expense-category" {...form.register("category")}>
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-description">Description</Label>
            <Input
              id="expense-description"
              placeholder="e.g. Printer paper, March rent"
              maxLength={MAX_DESCRIPTION_LENGTH}
              aria-invalid={Boolean(errors.description)}
              {...form.register("description")}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="expense-amount">Amount (₱)</Label>
              <Input id="expense-amount" type="number" inputMode="decimal" step="0.01" min="0" aria-invalid={Boolean(errors.amount)} {...form.register("amount")} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense-method">Paid with</Label>
              <Select id="expense-method" {...form.register("method")}>
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="other">Other</option>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expense-notes">Notes (optional)</Label>
            <Textarea id="expense-notes" aria-invalid={Boolean(errors.notes)} {...form.register("notes")} />
            {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createExpense.isPending}>
              {createExpense.isPending ? "Saving…" : "Save expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
