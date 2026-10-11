import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label, Select } from "@isnabero/ui";
import { useOfferings } from "@isnabero/module-catalog";
import { useStartTracking, type StockLevel } from "@isnabero/module-inventory";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { trackItemSchema, type TrackItemValues } from "./inventory-form-schema";

interface TrackItemModalProps {
  businessId: string;
  tracked: StockLevel[];
}

// TrackItemModal: pick a catalog item that isn't tracked yet and give it an opening count. Bookable bundles are left
// out (a booking uses a time slot, not stock).
export function TrackItemModal({ businessId, tracked }: TrackItemModalProps) {
  const [open, setOpen] = useState(false);
  const { employee } = useAuth();
  const { data: offerings = [] } = useOfferings(supabase, businessId);
  const startTracking = useStartTracking(supabase, businessId);
  const form = useForm<TrackItemValues>({ resolver: zodResolver(trackItemSchema), defaultValues: { offeringId: "", quantity: "", lowStockThreshold: "0" } });
  const { errors } = form.formState;

  const trackedIds = new Set(tracked.map((level) => level.offeringId));
  const choices = offerings.filter((offering) => !trackedIds.has(offering.id) && !offering.durationMinutes);

  const handleOpenChange = (next: boolean) => {
    if (next) form.reset({ offeringId: "", quantity: "", lowStockThreshold: "0" });
    setOpen(next);
  };

  const onSubmit = form.handleSubmit((values) => {
    startTracking.mutate(
      { offeringId: values.offeringId, quantity: Number(values.quantity), lowStockThreshold: Number(values.lowStockThreshold), recordedBy: employee?.id ?? null },
      {
        onSuccess: () => {
          toast.success("Now tracking stock");
          setOpen(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button onClick={() => handleOpenChange(true)}>
        <Plus className="h-4 w-4" />
        Track an item
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Track an item</DialogTitle>
          <DialogDescription>Choose a catalog item and enter how many you have right now. Sales will take from this count.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="track-offering">Item</Label>
            <Select id="track-offering" aria-invalid={Boolean(errors.offeringId)} {...form.register("offeringId")}>
              <option value="">{choices.length === 0 ? "Every item is already tracked" : "Choose an item…"}</option>
              {choices.map((offering) => (
                <option key={offering.id} value={offering.id}>
                  {offering.name}
                </option>
              ))}
            </Select>
            {errors.offeringId && <p className="text-xs text-destructive">{errors.offeringId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="track-quantity">In stock now</Label>
              <Input id="track-quantity" type="number" inputMode="numeric" min="0" step="1" aria-invalid={Boolean(errors.quantity)} {...form.register("quantity")} />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="track-threshold">Warn me at or below</Label>
              <Input id="track-threshold" type="number" inputMode="numeric" min="0" step="1" aria-invalid={Boolean(errors.lowStockThreshold)} {...form.register("lowStockThreshold")} />
              {errors.lowStockThreshold && <p className="text-xs text-destructive">{errors.lowStockThreshold.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={startTracking.isPending || choices.length === 0}>
              {startTracking.isPending ? "Saving…" : "Start tracking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
