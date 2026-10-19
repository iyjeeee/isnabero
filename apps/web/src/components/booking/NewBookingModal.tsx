import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@isnabero/ui";
import { useT } from "@/i18n";
import { BookingFormModal } from "./BookingFormModal";

interface NewBookingModalProps {
  businessId: string;
}

// NewBookingModal: the "New Booking" button plus the shared booking form in create mode
export function NewBookingModal({ businessId }: NewBookingModalProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" />
        {t("booking.modal.trigger")}
      </Button>
      <BookingFormModal businessId={businessId} open={open} onOpenChange={setOpen} />
    </>
  );
}
