import { useState } from "react";
import { Pencil } from "lucide-react";
import { ActionIconButton } from "@isnabero/ui";
import type { Expense } from "@isnabero/module-expenses";
import { useT } from "@/i18n";
import { ExpenseFormDialog } from "./ExpenseFormDialog";

// EditExpenseButton: row action that opens the expense form with the saved values (active expenses only)
export function EditExpenseButton({ businessId, expense }: { businessId: string; expense: Expense }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <ActionIconButton action="edit" icon={Pencil} onClick={() => setOpen(true)} aria-label={t("expenses.edit.ariaLabel", { label: expense.description })} />
      <ExpenseFormDialog businessId={businessId} open={open} onOpenChange={setOpen} expense={expense} />
    </>
  );
}
