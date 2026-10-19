import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label, Select } from "@isnabero/ui";
import { useOfferings } from "@isnabero/module-catalog";
import { useCreateBooking, useUpdateBooking, type BookingWithOffering } from "@isnabero/module-booking";
import { supabase } from "@/lib/supabase";
import { useT } from "@/i18n";
import { bookingMinutes, toDateTimeLocal } from "./booking-form";

interface BookingFormModalProps {
  businessId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking?: BookingWithOffering; // present = edit this booking, absent = create a new one
}

// BookingFormModal: one form for creating and editing a booking (controlled — NewBookingModal and BookingActions own the open state)
export function BookingFormModal({ businessId, open, onOpenChange, booking }: BookingFormModalProps) {
  const { t } = useT();
  const { data: offerings = [] } = useOfferings(supabase, businessId);
  const createBooking = useCreateBooking(supabase, businessId);
  const updateBooking = useUpdateBooking(supabase, businessId);
  const isEdit = Boolean(booking);

  const [offeringId, setOfferingId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [startTime, setStartTime] = useState("");

  // Fill the form from the booking being edited (or blank it for a new one) each time the dialog opens
  useEffect(() => {
    if (!open) return;
    setOfferingId(booking?.offeringId ?? "");
    setCustomerName(booking?.customerName ?? "");
    setCustomerContact(booking?.customerContact ?? "");
    setStartTime(booking ? toDateTimeLocal(booking.startTime) : "");
  }, [open, booking]);

  const isPending = createBooking.isPending || updateBooking.isPending;

  const handleSubmit = () => {
    const offering = offerings.find((item) => item.id === offeringId);
    if (!offering || !startTime || !customerName.trim()) {
      toast.error(t("booking.modal.fillIn"));
      return;
    }
    const start = new Date(startTime);
    const minutes = bookingMinutes({
      offeringDuration: offering.durationMinutes,
      existing: booking && { startTime: booking.startTime, endTime: booking.endTime, offeringChanged: offering.id !== booking.offeringId },
    });
    const details = {
      offeringId: offering.id,
      customerName: customerName.trim(),
      customerContact: customerContact.trim() || null,
      startTime: start,
      endTime: new Date(start.getTime() + minutes * 60000),
    };
    const done = (message: string) => ({
      onSuccess: () => {
        toast.success(message);
        onOpenChange(false);
      },
    });
    if (booking) {
      updateBooking.mutate({ bookingId: booking.id, input: details }, done(t("booking.modal.updated", { customer: details.customerName })));
    } else {
      createBooking.mutate({ ...details, mode: "appointment", paymentRecordId: null }, done(t("booking.modal.booked", { customer: details.customerName, offering: offering.name })));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("booking.modal.editTitle") : t("booking.modal.title")}</DialogTitle>
          <DialogDescription>{isEdit ? t("booking.modal.editDescription") : t("booking.modal.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="booking-offering">{t("booking.modal.package")}</Label>
            <Select id="booking-offering" value={offeringId} onChange={(event) => setOfferingId(event.target.value)}>
              <option value="">{t("booking.modal.packagePlaceholder")}</option>
              {offerings
                .filter((offering) => offering.durationMinutes || offering.id === booking?.offeringId)
                .map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    {offering.name}
                  </option>
                ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="booking-customerName">{t("booking.modal.customerName")}</Label>
            <Input id="booking-customerName" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="booking-customerContact">{t("booking.modal.contact")}</Label>
            <Input id="booking-customerContact" placeholder={t("booking.modal.contactPlaceholder")} value={customerContact} onChange={(event) => setCustomerContact(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="booking-startTime">{t("booking.modal.startTime")}</Label>
            <Input id="booking-startTime" type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isEdit ? (isPending ? t("common.saving") : t("booking.modal.save")) : isPending ? t("booking.modal.booking") : t("booking.modal.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
