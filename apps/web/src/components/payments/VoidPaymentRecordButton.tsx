import { useState } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, ActionIconButton } from "@isnabero/ui";
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
  const [open, setOpen] = useState(false);
  const voidPaymentRecord = useVoidPaymentRecord(businessId);

  return (
    <>
      <ActionIconButton action="delete" icon={Ban} onClick={() => setOpen(true)} aria-label={`Void transaction ${amountLabel}`} />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Void this transaction?"
        description={`This marks the ${amountLabel} transaction as voided and excludes it from totals. It stays visible under "Show voided" for your records and does NOT reverse the related order or booking.`}
        confirmLabel="Void transaction"
        isPending={voidPaymentRecord.isPending}
        onConfirm={() =>
          voidPaymentRecord.mutate(recordId, {
            onSuccess: () => {
              toast.success("Transaction voided");
              setOpen(false);
            },
          })
        }
      />
    </>
  );
}
