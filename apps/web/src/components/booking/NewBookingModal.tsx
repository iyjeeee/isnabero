import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label, Select } from "@isnabero/ui";
import { useOfferings } from "@isnabero/module-catalog";
import { useCreateBooking } from "@isnabero/module-booking";
import { supabase } from "@/lib/supabase";
import { useT } from "@/i18n";

interface NewBookingModalProps {
  businessId: string;
}

export function NewBookingModal({ businessId }: NewBookingModalProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const { data: offerings = [] } = useOfferings(supabase, businessId);
  const createBooking = useCreateBooking(supabase, businessId);

  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [startTime, setStartTime] = useState("");

  const resetForm = () => {
    setSelectedOfferingId("");
    setCustomerName("");
    setStartTime("");
  };

  const handleCreate = () => {
    const offering = offerings.find((item) => item.id === selectedOfferingId);
    if (!offering || !startTime || !customerName.trim()) {
      toast.error(t("booking.modal.fillIn"));
      return;
    }
    const start = new Date(startTime);
    const end = new Date(start.getTime() + (offering.durationMinutes ?? 60) * 60000);
    createBooking.mutate(
      {
        offeringId: offering.id,
        mode: "appointment",
        customerName: customerName.trim(),
        customerContact: null,
        startTime: start,
        endTime: end,
        paymentRecordId: null,
      },
      {
        onSuccess: () => {
          toast.success(t("booking.modal.booked", { customer: customerName, offering: offering.name }));
          resetForm();
          setOpen(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" />
        {t("booking.modal.trigger")}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("booking.modal.title")}</DialogTitle>
          <DialogDescription>{t("booking.modal.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="booking-offering">{t("booking.modal.package")}</Label>
            <Select id="booking-offering" value={selectedOfferingId} onChange={(event) => setSelectedOfferingId(event.target.value)}>
              <option value="">{t("booking.modal.packagePlaceholder")}</option>
              {offerings
                .filter((offering) => offering.durationMinutes)
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
            <Label htmlFor="booking-startTime">{t("booking.modal.startTime")}</Label>
            <Input id="booking-startTime" type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={createBooking.isPending}>
            {createBooking.isPending ? t("booking.modal.booking") : t("booking.modal.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
