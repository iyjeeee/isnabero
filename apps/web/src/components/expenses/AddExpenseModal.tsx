import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@isnabero/ui";
import { useT } from "@/i18n";
import { ExpenseFormDialog } from "./ExpenseFormDialog";

// AddExpenseModal: the "Add expense" button and its form
export function AddExpenseModal({ businessId }: { businessId: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {t("expenses.modal.trigger")}
      </Button>
      <ExpenseFormDialog businessId={businessId} open={open} onOpenChange={setOpen} />
    </>
  );
}
