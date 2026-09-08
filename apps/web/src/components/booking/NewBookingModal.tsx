import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label, Select } from "@isnabero/ui";
import { useOfferings } from "@isnabero/module-catalog";
import { useCreateBooking } from "@isnabero/module-booking";
import { supabase } from "@/lib/supabase";

interface NewBookingModalProps {
  businessId: string;
}

export function NewBookingModal({ businessId }: NewBookingModalProps) {
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
    if (!offering || !startTime || !customerName) {
      toast.error("Fill in a package, customer name, and start time first");
      return;
    }
    const start = new Date(startTime);
    const end = new Date(start.getTime() + (offering.durationMinutes ?? 60) * 60000);
    createBooking.mutate(
      {
        offeringId: offering.id,
        mode: "appointment",
        customerName,
        customerContact: null,
        startTime: start,
        endTime: end,
        paymentRecordId: null,
      },
      {
        onSuccess: () => {
          toast.success(`Booked ${customerName} for ${offering.name}`);
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
        New Booking
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New booking</DialogTitle>
          <DialogDescription>Reserve a slot against a bookable package from Catalog.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="booking-offering">Package</Label>
            <Select id="booking-offering" value={selectedOfferingId} onChange={(event) => setSelectedOfferingId(event.target.value)}>
              <option value="">Select a package…</option>
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
            <Label htmlFor="booking-customerName">Customer name</Label>
            <Input id="booking-customerName" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="booking-startTime">Start time</Label>
            <Input id="booking-startTime" type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createBooking.isPending}>
            {createBooking.isPending ? "Booking…" : "Confirm Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
