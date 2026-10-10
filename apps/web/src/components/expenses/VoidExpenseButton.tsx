import { useState } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, ActionIconButton } from "@isnabero/ui";
import { useVoidExpense } from "@isnabero/module-expenses";
import { supabase } from "@/lib/supabase";

interface VoidExpenseButtonProps {
  businessId: string;
  expenseId: string;
  label: string; // e.g. "Office rent ₱8,000.00"
}

// Voiding is a soft delete (sets voided_at): the expense leaves totals and the default list but stays under "Show voided".
export function VoidExpenseButton({ businessId, expenseId, label }: VoidExpenseButtonProps) {
  const [open, setOpen] = useState(false);
  const voidExpense = useVoidExpense(supabase, businessId);

  return (
    <>
      <ActionIconButton action="delete" icon={Ban} onClick={() => setOpen(true)} aria-label={`Void expense ${label}`} />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Void this expense?"
        description={`This marks "${label}" as voided and excludes it from totals. It stays visible under "Show voided" for your records.`}
        confirmLabel="Void expense"
        isPending={voidExpense.isPending}
        onConfirm={() =>
          voidExpense.mutate(expenseId, {
            onSuccess: () => {
              toast.success("Expense voided");
              setOpen(false);
            },
          })
        }
      />
    </>
  );
}
