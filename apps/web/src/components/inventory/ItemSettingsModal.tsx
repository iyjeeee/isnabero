import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button, ConfirmDialog, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label, ActionIconButton } from "@isnabero/ui";
import { useSetLowStockThreshold, useStopTracking, type StockLevel } from "@isnabero/module-inventory";
import { supabase } from "@/lib/supabase";
import { useT } from "@/i18n";
import { settingsSchema, type SettingsValues } from "./inventory-form-schema";

interface ItemSettingsModalProps {
  businessId: string;
  level: StockLevel;
}

// ItemSettingsModal: change the low-stock warning level, or stop tracking the item (its history is kept).
export function ItemSettingsModal({ businessId, level }: ItemSettingsModalProps) {
  const [open, setOpen] = useState(false);
  const { t, tm } = useT();
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
          toast.success(t("inventory.settings.saved"));
          setOpen(false);
        },
      },
    );
  });

  return (
    <>
      <ActionIconButton action="edit" icon={Settings2} onClick={() => handleOpenChange(true)} aria-label={t("inventory.settings.aria", { name: level.offeringName })} />
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("inventory.settings.title", { name: level.offeringName })}</DialogTitle>
            <DialogDescription>{t("inventory.settings.description")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="settings-threshold">{t("inventory.warnAt")}</Label>
              <Input id="settings-threshold" type="number" inputMode="numeric" min="0" step="1" aria-invalid={Boolean(errors.lowStockThreshold)} {...form.register("lowStockThreshold")} />
              {errors.lowStockThreshold && <p className="text-xs text-destructive">{tm(errors.lowStockThreshold.message)}</p>}
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
                {t("inventory.settings.stop")}
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={setThreshold.isPending}>
                  {setThreshold.isPending ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmStop}
        onOpenChange={setConfirmStop}
        title={t("inventory.settings.confirmTitle", { name: level.offeringName })}
        description={t("inventory.settings.confirmDescription")}
        confirmLabel={t("inventory.settings.stop")}
        isPending={stopTracking.isPending}
        onConfirm={() =>
          stopTracking.mutate(level.offeringId, {
            onSuccess: () => {
              toast.success(t("inventory.settings.stopped", { name: level.offeringName }));
              setConfirmStop(false);
            },
          })
        }
      />
    </>
  );
}
