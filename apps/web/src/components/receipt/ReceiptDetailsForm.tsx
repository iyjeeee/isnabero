import { Input, Label, Textarea } from "@isnabero/ui";
import {
  RECEIPT_ADDRESS_MAX,
  RECEIPT_CONTACT_MAX,
  RECEIPT_FOOTER_MAX,
  type ReceiptDetailsErrors,
  type ReceiptDetailsInput,
} from "@/lib/repositories/repository";
import { useT } from "@/i18n";

// ReceiptDetailsForm: the fields for the business info printed at the top and bottom of every receipt (all optional). Controlled by the setup wizard, which saves them.
export function ReceiptDetailsForm({ value, errors, onChange }: { value: ReceiptDetailsInput; errors: ReceiptDetailsErrors; onChange: (field: keyof ReceiptDetailsInput, text: string) => void }) {
  const { t } = useT();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("receipt.details.description")}</p>

      <div className="space-y-1.5">
        <Label htmlFor="receipt-address">{t("receipt.details.address")}</Label>
        <Textarea id="receipt-address" rows={2} maxLength={RECEIPT_ADDRESS_MAX} value={value.address} onChange={(event) => onChange("address", event.target.value)} aria-invalid={Boolean(errors.address)} />
        {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="receipt-tin">{t("receipt.details.tin")}</Label>
          <Input id="receipt-tin" placeholder="123-456-789-000" inputMode="numeric" value={value.tin} onChange={(event) => onChange("tin", event.target.value)} aria-invalid={Boolean(errors.tin)} />
          {errors.tin && <p className="text-xs text-destructive">{errors.tin}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="receipt-contact">{t("receipt.details.contact")}</Label>
          <Input id="receipt-contact" inputMode="tel" maxLength={RECEIPT_CONTACT_MAX} value={value.contactNumber} onChange={(event) => onChange("contactNumber", event.target.value)} aria-invalid={Boolean(errors.contactNumber)} />
          {errors.contactNumber && <p className="text-xs text-destructive">{errors.contactNumber}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="receipt-footer">{t("receipt.details.footer")}</Label>
        <Input id="receipt-footer" placeholder={t("receipt.details.footerPlaceholder")} maxLength={RECEIPT_FOOTER_MAX} value={value.receiptFooter} onChange={(event) => onChange("receiptFooter", event.target.value)} aria-invalid={Boolean(errors.receiptFooter)} />
        {errors.receiptFooter && <p className="text-xs text-destructive">{errors.receiptFooter}</p>}
      </div>

      <p className="text-xs text-muted-foreground">{t("receipt.details.disclaimer")}</p>
    </div>
  );
}
