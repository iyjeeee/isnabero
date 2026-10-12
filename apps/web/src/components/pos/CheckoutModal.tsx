import { useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label, Select } from "@isnabero/ui";
import type { CartLine } from "@isnabero/module-pos";
import { useT, useLabels } from "@/i18n";

const PAYMENT_METHODS = ["cash", "gcash", "bank_transfer", "other"] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number];

interface CheckoutModalProps {
  lines: CartLine[];
  total: number;
  isPending: boolean;
  onConfirm: (method: PaymentMethod, referenceCode?: string) => void;
}

export function CheckoutModal({ lines, total, isPending, onConfirm }: CheckoutModalProps) {
  const { t } = useT();
  const labels = useLabels();
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
      <Button className="w-full" disabled={lines.length === 0 || isPending} onClick={() => setOpen(true)}>
        {t("pos.checkout.button", { total: total.toFixed(2) })}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("pos.checkout.title")}</DialogTitle>
          <DialogDescription>{t("pos.checkout.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2">
            <span className="text-sm text-muted-foreground">{t("pos.checkout.totalDue")}</span>
            <span className="font-semibold">₱{total.toFixed(2)}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="method">{t("pos.checkout.method")}</Label>
            <Select id="method" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((option) => (
                <option key={option} value={option}>
                  {labels.method(option)}
                </option>
              ))}
            </Select>
          </div>

          {needsReference && (
            <div className="space-y-1.5">
              <Label htmlFor="referenceCode">{t("pos.checkout.referenceCode")}</Label>
              <Input
                id="referenceCode"
                placeholder={t("pos.checkout.referencePlaceholder")}
                value={referenceCode}
                onChange={(event) => setReferenceCode(event.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || (needsReference && !referenceCode)}>
            {isPending ? t("pos.checkout.processing") : t("pos.checkout.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
