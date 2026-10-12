import { useState } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, ActionIconButton } from "@isnabero/ui";
import { useT } from "@/i18n";
import { useVoidPaymentRecord } from "@/hooks/use-void-payment-record";

interface VoidPaymentRecordButtonProps {
  businessId: string;
  recordId: string;
  amountLabel: string;
}

// Voiding a payment record does NOT delete it or the linked POS order/booking — it's a soft delete
// (sets voided_at) so mistaken/duplicate entries are excluded from totals and the default list, while
// the record itself is preserved for audit purposes. See PaymentsPage's "Show voided" toggle to review
// voided records.
export function VoidPaymentRecordButton({ businessId, recordId, amountLabel }: VoidPaymentRecordButtonProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const voidPaymentRecord = useVoidPaymentRecord(businessId);

  return (
    <>
      <ActionIconButton action="delete" icon={Ban} onClick={() => setOpen(true)} aria-label={t("payments.void.ariaLabel", { amount: amountLabel })} />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("payments.void.title")}
        description={t("payments.void.description", { amount: amountLabel })}
        confirmLabel={t("payments.void.confirm")}
        isPending={voidPaymentRecord.isPending}
        onConfirm={() =>
          voidPaymentRecord.mutate(recordId, {
            onSuccess: () => {
              toast.success(t("payments.void.success"));
              setOpen(false);
            },
          })
        }
      />
    </>
  );
}
