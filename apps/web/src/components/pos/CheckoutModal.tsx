import { useState, type Ref } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label, Select } from "@isnabero/ui";
import type { CartLine } from "@isnabero/module-pos";
import { useT, useLabels } from "@/i18n";
import { formatAmount, formatPeso } from "@/lib/money";
import { changeDue, quickTenders } from "@/lib/cash-change";

const PAYMENT_METHODS = ["cash", "gcash", "bank_transfer", "other"] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number];

interface CheckoutModalProps {
  triggerRef?: Ref<HTMLButtonElement>; // lets the POS page open checkout with a shortcut
  lines: CartLine[];
  total: number;
  isPending: boolean;
  onConfirm: (method: PaymentMethod, referenceCode?: string) => void;
}

export function CheckoutModal({ triggerRef, lines, total, isPending, onConfirm }: CheckoutModalProps) {
  const { t } = useT();
  const labels = useLabels();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [referenceCode, setReferenceCode] = useState("");
  const [tendered, setTendered] = useState(""); // cash handed over by the customer (cash sales only; not saved with the sale)

  // referenceCode is only meaningful for non-cash methods — GCash/bank transfer just need the ref number for reconciliation
  const needsReference = method !== "cash";
  const change = method === "cash" && tendered.trim() !== "" ? changeDue(total, Number(tendered)) : null;
  const shortOfTotal = change !== null && change < 0; // the customer has not given enough yet

  const handleConfirm = () => {
    onConfirm(method, needsReference ? referenceCode : undefined);
    setOpen(false);
    setMethod("cash");
    setReferenceCode("");
    setTendered("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button ref={triggerRef} className="w-full" disabled={lines.length === 0 || isPending} onClick={() => setOpen(true)}>
        {t("pos.checkout.button", { total: formatAmount(total) })}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("pos.checkout.title")}</DialogTitle>
          <DialogDescription>{t("pos.checkout.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2">
            <span className="text-sm text-muted-foreground">{t("pos.checkout.totalDue")}</span>
            <span className="font-semibold">{formatPeso(total)}</span>
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

          {method === "cash" && (
            <div className="space-y-2">
              <Label htmlFor="tendered">{t("pos.checkout.tendered")}</Label>
              <Input id="tendered" type="number" inputMode="decimal" min="0" step="0.01" placeholder={t("pos.checkout.tenderedPlaceholder")} value={tendered} onChange={(event) => setTendered(event.target.value)} />
              <div className="flex flex-wrap gap-2">
                {quickTenders(total).map((amount) => (
                  <Button key={amount} type="button" size="sm" variant="outline" onClick={() => setTendered(String(amount))}>
                    {amount === Math.ceil(total) ? t("pos.checkout.exact") : formatPeso(amount)}
                  </Button>
                ))}
              </div>
              {change !== null && (
                <div role="status" className={`flex items-center justify-between rounded-md border px-3 py-2 ${shortOfTotal ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-success/40 bg-success/10"}`}>
                  <span className="text-sm">{shortOfTotal ? t("pos.checkout.stillOwed") : t("pos.checkout.changeDue")}</span>
                  <span className="font-display text-lg font-bold" data-testid="change-due">{formatPeso(Math.abs(change))}</span>
                </div>
              )}
            </div>
          )}

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
          <Button onClick={handleConfirm} disabled={isPending || (needsReference && !referenceCode) || shortOfTotal}>
            {isPending ? t("pos.checkout.processing") : t("pos.checkout.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
