import { useState } from "react";
import { Ban, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ActionIconButton, Button, ConfirmDialog } from "@isnabero/ui";
import { isEditable, nextStatuses, useUpdateBookingStatus, type BookingStatus, type BookingWithOffering } from "@isnabero/module-booking";
import { supabase } from "@/lib/supabase";
import { useT } from "@/i18n";
import { BookingFormModal } from "./BookingFormModal";

interface BookingActionsProps {
  businessId: string;
  booking: BookingWithOffering;
}

// BookingActions: the buttons on a booking card — move it forward (confirm / complete), edit it, or cancel it. Final bookings show none.
export function BookingActions({ businessId, booking }: BookingActionsProps) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const updateStatus = useUpdateBookingStatus(supabase, businessId);
  const next = nextStatuses(booking.status);
  const forward = next.find((status) => status === "confirmed" || status === "completed");

  const change = (status: BookingStatus, message: string, after?: () => void) =>
    updateStatus.mutate({ bookingId: booking.id, status }, { onSuccess: () => { toast.success(message); after?.(); } });

  if (next.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      {forward && (
        <Button variant="outline" size="sm" disabled={updateStatus.isPending} onClick={() => change(forward, t(forward === "confirmed" ? "booking.actions.confirmed" : "booking.actions.completed", { customer: booking.customerName }))}>
          {t(forward === "confirmed" ? "booking.actions.confirm" : "booking.actions.complete")}
        </Button>
      )}
      {isEditable(booking.status) && (
        <ActionIconButton action="edit" icon={Pencil} onClick={() => setEditing(true)} aria-label={t("booking.actions.edit", { customer: booking.customerName })} />
      )}
      <ActionIconButton action="delete" icon={Ban} onClick={() => setCancelling(true)} aria-label={t("booking.actions.cancel")} title={t("booking.actions.cancel")} />

      <BookingFormModal businessId={businessId} open={editing} onOpenChange={setEditing} booking={booking} />
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={t("booking.cancelDialog.title")}
        description={t("booking.cancelDialog.description", { customer: booking.customerName, offering: booking.offering.name })}
        confirmLabel={t("booking.cancelDialog.confirm")}
        isPending={updateStatus.isPending}
        onConfirm={() => change("cancelled", t("booking.actions.cancelled", { customer: booking.customerName }), () => setCancelling(false))}
      />
    </div>
  );
}
