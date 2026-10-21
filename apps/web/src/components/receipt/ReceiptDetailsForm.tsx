import { useState } from "react";
import { toast } from "sonner";
import { Button, Input, Label, Textarea } from "@isnabero/ui";
import {
  RECEIPT_ADDRESS_MAX,
  RECEIPT_CONTACT_MAX,
  RECEIPT_FOOTER_MAX,
  validateReceiptDetails,
  type BusinessView,
  type ReceiptDetailsErrors,
  type ReceiptDetailsInput,
} from "@/lib/repositories/repository";
import { useSaveReceiptDetails } from "@/hooks/use-save-receipt-details";
import { useT } from "@/i18n";

// ReceiptDetailsForm: the business info printed at the top and bottom of every receipt. All optional. Lives inside the Business Setup modal.
export function ReceiptDetailsForm({ business }: { business: BusinessView }) {
  const { t } = useT();
  const save = useSaveReceiptDetails(business.id);
  const [form, setForm] = useState<ReceiptDetailsInput>({
    address: business.address ?? "",
    tin: business.tin ?? "",
    contactNumber: business.contactNumber ?? "",
    receiptFooter: business.receiptFooter ?? "",
  });
  const [errors, setErrors] = useState<ReceiptDetailsErrors>({});

  const set = (field: keyof ReceiptDetailsInput, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = validateReceiptDetails(form);
    setErrors(result.errors);
    if (Object.keys(result.errors).length > 0) return;
    save.mutate(form, {
      onSuccess: (saved) => {
        // Show the cleaned-up values (trimmed, TIN dashes)
        setForm({ address: saved.address ?? "", tin: saved.tin ?? "", contactNumber: saved.contactNumber ?? "", receiptFooter: saved.receiptFooter ?? "" });
        toast.success(t("receipt.details.saved"));
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <h3 className="font-display text-base font-semibold">{t("receipt.details.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("receipt.details.description")}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="receipt-address">{t("receipt.details.address")}</Label>
        <Textarea id="receipt-address" rows={2} maxLength={RECEIPT_ADDRESS_MAX} value={form.address} onChange={(event) => set("address", event.target.value)} aria-invalid={Boolean(errors.address)} />
        {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="receipt-tin">{t("receipt.details.tin")}</Label>
          <Input id="receipt-tin" placeholder="123-456-789-000" inputMode="numeric" value={form.tin} onChange={(event) => set("tin", event.target.value)} aria-invalid={Boolean(errors.tin)} />
          {errors.tin && <p className="text-xs text-destructive">{errors.tin}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="receipt-contact">{t("receipt.details.contact")}</Label>
          <Input id="receipt-contact" inputMode="tel" maxLength={RECEIPT_CONTACT_MAX} value={form.contactNumber} onChange={(event) => set("contactNumber", event.target.value)} aria-invalid={Boolean(errors.contactNumber)} />
          {errors.contactNumber && <p className="text-xs text-destructive">{errors.contactNumber}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="receipt-footer">{t("receipt.details.footer")}</Label>
        <Input id="receipt-footer" placeholder={t("receipt.details.footerPlaceholder")} maxLength={RECEIPT_FOOTER_MAX} value={form.receiptFooter} onChange={(event) => set("receiptFooter", event.target.value)} aria-invalid={Boolean(errors.receiptFooter)} />
        {errors.receiptFooter && <p className="text-xs text-destructive">{errors.receiptFooter}</p>}
      </div>

      <p className="text-xs text-muted-foreground">{t("receipt.details.disclaimer")}</p>

      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? t("common.saving") : t("receipt.details.submit")}
        </Button>
      </div>
    </form>
  );
}
