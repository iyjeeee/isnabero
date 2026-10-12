import { useState } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, ActionIconButton } from "@isnabero/ui";
import { useVoidExpense } from "@isnabero/module-expenses";
import { supabase } from "@/lib/supabase";
import { useT } from "@/i18n";

interface VoidExpenseButtonProps {
  businessId: string;
  expenseId: string;
  label: string; // e.g. "Office rent ₱8,000.00"
}

// Voiding is a soft delete (sets voided_at): the expense leaves totals and the default list but stays under "Show voided".
export function VoidExpenseButton({ businessId, expenseId, label }: VoidExpenseButtonProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const voidExpense = useVoidExpense(supabase, businessId);

  return (
    <>
      <ActionIconButton action="delete" icon={Ban} onClick={() => setOpen(true)} aria-label={t("expenses.void.ariaLabel", { label })} />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("expenses.void.title")}
        description={t("expenses.void.description", { label })}
        confirmLabel={t("expenses.void.confirm")}
        isPending={voidExpense.isPending}
        onConfirm={() =>
          voidExpense.mutate(expenseId, {
            onSuccess: () => {
              toast.success(t("expenses.void.done"));
              setOpen(false);
            },
          })
        }
      />
    </>
  );
}
