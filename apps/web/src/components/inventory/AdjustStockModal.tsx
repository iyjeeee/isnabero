import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { MANUAL_STOCK_KINDS } from "@isnabero/db";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label, Select } from "@isnabero/ui";
import { useAdjustStock, formatDelta, type StockLevel } from "@isnabero/module-inventory";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";
import { adjustSchema, computeDelta, type AdjustValues } from "./inventory-form-schema";

interface AdjustStockModalProps {
  businessId: string;
  level: StockLevel;
}

// AdjustStockModal: the only way to change a count by hand. A reason is always required; it goes in the movement history
// and the Audit Log. "Correction" asks for the number you counted and works out the difference.
export function AdjustStockModal({ businessId, level }: AdjustStockModalProps) {
  const [open, setOpen] = useState(false);
  const { employee } = useAuth();
  const adjust = useAdjustStock(supabase, businessId);
  const form = useForm<AdjustValues>({ resolver: zodResolver(adjustSchema), defaultValues: { kind: "restock", quantity: "", note: "" } });
  const { errors } = form.formState;
  const kind = form.watch("kind");
  const quantity = form.watch("quantity");

  const preview = /^\d+$/.test(quantity) ? level.quantity + computeDelta(kind, Number(quantity), level.quantity) : null;

  const handleOpenChange = (next: boolean) => {
    if (next) form.reset({ kind: "restock", quantity: "", note: "" });
    setOpen(next);
  };

  const onSubmit = form.handleSubmit((values) => {
    const delta = computeDelta(values.kind, Number(values.quantity), level.quantity);
    if (delta === 0) {
      form.setError("quantity", { message: "That's already the current count" });
      return;
    }
    adjust.mutate(
      { offeringId: level.offeringId, kind: values.kind, delta, note: values.note, recordedBy: employee?.id ?? null },
      {
        onSuccess: () => {
          toast.success(`${level.offeringName}: ${formatDelta(delta)} (now ${level.quantity + delta})`);
          setOpen(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button variant="outline" size="sm" onClick={() => handleOpenChange(true)} aria-label={`Adjust stock for ${level.offeringName}`}>
        Adjust
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust {level.offeringName}</DialogTitle>
          <DialogDescription>Currently {level.quantity} in stock. Every change is saved with your reason.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="adjust-kind">What happened</Label>
              <Select id="adjust-kind" {...form.register("kind")}>
                {MANUAL_STOCK_KINDS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adjust-quantity">{kind === "correction" ? "Counted quantity" : "Quantity"}</Label>
              <Input id="adjust-quantity" type="number" inputMode="numeric" min="0" step="1" aria-invalid={Boolean(errors.quantity)} {...form.register("quantity")} />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
            </div>
          </div>
          <p className="text-sm text-muted-foreground" role="status">
            {preview === null ? "Enter a quantity to see the new count." : preview < 0 ? `That would leave ${preview} — not allowed.` : `New count: ${preview}`}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="adjust-note">Reason</Label>
            <Input id="adjust-note" placeholder="e.g. Delivery from supplier, spoiled overnight" aria-invalid={Boolean(errors.note)} {...form.register("note")} />
            {errors.note && <p className="text-xs text-destructive">{errors.note.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={adjust.isPending}>
              {adjust.isPending ? "Saving…" : "Save adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
