import { useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label, Select } from "@isnabero/ui";
import type { CartLine } from "@isnabero/module-pos";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "other", label: "Other" },
] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

interface CheckoutModalProps {
  lines: CartLine[];
  total: number;
  isPending: boolean;
  onConfirm: (method: PaymentMethod, referenceCode?: string) => void;
}

export function CheckoutModal({ lines, total, isPending, onConfirm }: CheckoutModalProps) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [referenceCode, setReferenceCode] = useState("");

  // referenceCode is only meaningful for non-cash methods — GCash/bank transfer just need the ref number for reconciliation
  const needsReference = method !== "cash";

  const handleConfirm = () => {
    onConfirm(method, needsReference ? referenceCode : undefined);
    setOpen(false);
    setMethod("cash");
    setReferenceCode("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button className="w-full" disabled={lines.length === 0} onClick={() => setOpen(true)}>
        Checkout — ₱{total.toFixed(2)}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete sale</DialogTitle>
          <DialogDescription>Select how the customer paid.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2">
            <span className="text-sm text-muted-foreground">Total due</span>
            <span className="font-semibold">₱{total.toFixed(2)}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="method">Payment method</Label>
            <Select id="method" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {needsReference && (
            <div className="space-y-1.5">
              <Label htmlFor="referenceCode">Reference code</Label>
              <Input
                id="referenceCode"
                placeholder="e.g. GCash ref number"
                value={referenceCode}
                onChange={(event) => setReferenceCode(event.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || (needsReference && !referenceCode)}>
            {isPending ? "Processing…" : "Confirm payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
