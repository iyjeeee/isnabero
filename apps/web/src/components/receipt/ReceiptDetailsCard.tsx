import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardContent, Input, Label, Textarea } from "@isnabero/ui";
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

// ReceiptDetailsCard: the business info printed at the top and bottom of every receipt. All optional.
export function ReceiptDetailsCard({ business }: { business: BusinessView }) {
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
        toast.success("Receipt details saved");
      },
    });
  };

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <h2 className="font-display text-lg font-semibold">Receipt details</h2>
            <p className="text-sm text-muted-foreground">Printed on every sales receipt. Leave a field empty to leave it off.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="receipt-address">Address</Label>
            <Textarea id="receipt-address" rows={2} maxLength={RECEIPT_ADDRESS_MAX} value={form.address} onChange={(event) => set("address", event.target.value)} aria-invalid={Boolean(errors.address)} />
            {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="receipt-tin">TIN</Label>
              <Input id="receipt-tin" placeholder="123-456-789-000" inputMode="numeric" value={form.tin} onChange={(event) => set("tin", event.target.value)} aria-invalid={Boolean(errors.tin)} />
              {errors.tin && <p className="text-xs text-destructive">{errors.tin}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receipt-contact">Contact number</Label>
              <Input id="receipt-contact" inputMode="tel" maxLength={RECEIPT_CONTACT_MAX} value={form.contactNumber} onChange={(event) => set("contactNumber", event.target.value)} aria-invalid={Boolean(errors.contactNumber)} />
              {errors.contactNumber && <p className="text-xs text-destructive">{errors.contactNumber}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="receipt-footer">Footer message</Label>
            <Input id="receipt-footer" placeholder="Thank you! Come again." maxLength={RECEIPT_FOOTER_MAX} value={form.receiptFooter} onChange={(event) => set("receiptFooter", event.target.value)} aria-invalid={Boolean(errors.receiptFooter)} />
            {errors.receiptFooter && <p className="text-xs text-destructive">{errors.receiptFooter}</p>}
          </div>

          <p className="text-xs text-muted-foreground">Receipts from Isnabero are sales receipts. They are not BIR-registered official receipts and say so at the bottom.</p>

          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save receipt details"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
