import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button, ConfirmDialog, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label, ActionIconButton } from "@isnabero/ui";
import { useSetLowStockThreshold, useStopTracking, type StockLevel } from "@isnabero/module-inventory";
import { supabase } from "@/lib/supabase";
import { settingsSchema, type SettingsValues } from "./inventory-form-schema";

interface ItemSettingsModalProps {
  businessId: string;
  level: StockLevel;
}

// ItemSettingsModal: change the low-stock warning level, or stop tracking the item (its history is kept).
export function ItemSettingsModal({ businessId, level }: ItemSettingsModalProps) {
  const [open, setOpen] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const setThreshold = useSetLowStockThreshold(supabase, businessId);
  const stopTracking = useStopTracking(supabase, businessId);
  const form = useForm<SettingsValues>({ resolver: zodResolver(settingsSchema), defaultValues: { lowStockThreshold: String(level.lowStockThreshold) } });
  const { errors } = form.formState;

  const handleOpenChange = (next: boolean) => {
    if (next) form.reset({ lowStockThreshold: String(level.lowStockThreshold) });
    setOpen(next);
  };

  const onSubmit = form.handleSubmit((values) => {
    setThreshold.mutate(
      { offeringId: level.offeringId, threshold: Number(values.lowStockThreshold) },
      {
        onSuccess: () => {
          toast.success("Low-stock level saved");
          setOpen(false);
        },
      },
    );
  });

  return (
    <>
      <ActionIconButton action="edit" icon={Settings2} onClick={() => handleOpenChange(true)} aria-label={`Settings for ${level.offeringName}`} />
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{level.offeringName} settings</DialogTitle>
            <DialogDescription>You'll see a warning when the count reaches this level. Use 0 for no warning.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="settings-threshold">Warn me at or below</Label>
              <Input id="settings-threshold" type="number" inputMode="numeric" min="0" step="1" aria-invalid={Boolean(errors.lowStockThreshold)} {...form.register("lowStockThreshold")} />
              {errors.lowStockThreshold && <p className="text-xs text-destructive">{errors.lowStockThreshold.message}</p>}
            </div>
            <DialogFooter className="sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  setOpen(false);
                  setConfirmStop(true);
                }}
              >
                Stop tracking
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={setThreshold.isPending}>
                  {setThreshold.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmStop}
        onOpenChange={setConfirmStop}
        title={`Stop tracking ${level.offeringName}?`}
        description="Sales will no longer take from its count and it won't need restocking alerts. Its history stays in the Audit Log, and you can track it again later."
        confirmLabel="Stop tracking"
        isPending={stopTracking.isPending}
        onConfirm={() =>
          stopTracking.mutate(level.offeringId, {
            onSuccess: () => {
              toast.success(`No longer tracking ${level.offeringName}`);
              setConfirmStop(false);
            },
          })
        }
      />
    </>
  );
}
