import { ReceiptText } from "lucide-react";
import { formatReceiptNumber } from "@isnabero/module-pos";
import { Badge, Button } from "@isnabero/ui";
import { useFormat, useLabels, useT } from "@/i18n";
import { formatPeso } from "@/lib/money";
import type { PaymentRecordView } from "@/lib/repositories/repository";
import { DetailDialog } from "./DetailDialog";

interface PaymentDetailDialogProps {
  record: PaymentRecordView | null; // null = closed
  onClose: () => void;
  onViewReceipt: (recordId: string) => void;
}

export function PaymentDetailDialog({ record, onClose, onViewReceipt }: PaymentDetailDialogProps) {
  const { t } = useT();
  const format = useFormat();
  const labels = useLabels();
  if (!record) return null;
  const source = record.sourceModule === "pos" ? t("payments.source.pos") : record.sourceModule === "booking" ? t("payments.source.booking") : record.sourceModule;
  return (
    <DetailDialog
      open
      onClose={onClose}
      title={t("details.titles.payment")}
      description={`${formatPeso(record.amount)} · ${format.dateTime(record.createdAt)}`}
      badges={record.voidedAt ? <Badge variant="destructive">{labels.orderStatus("voided")}</Badge> : <Badge variant="success">{t("details.active")}</Badge>}
      fields={[
        { label: t("details.fields.amount"), value: <span className="font-display text-lg font-bold">{formatPeso(record.amount)}</span> },
        { label: t("details.fields.date"), value: format.dateTime(record.createdAt) },
        { label: t("details.fields.source"), value: source },
        { label: t("details.fields.method"), value: labels.method(record.method) },
        { label: t("details.fields.reference"), value: record.referenceCode },
        { label: t("details.fields.receipt"), value: record.receiptNumber ? formatReceiptNumber(record.receiptNumber) : null },
        { label: t("details.fields.cashier"), value: record.cashierName },
        { label: t("details.fields.customer"), value: record.customerName },
        { label: t("details.fields.items"), value: record.summary, wide: true },
        ...(record.voidedAt ? [{ label: t("details.voidedOn"), value: format.dateTime(record.voidedAt) }] : []),
      ]}
      actions={
        record.sourceModule === "pos" ? (
          <Button type="button" variant="outline" onClick={() => { onClose(); onViewReceipt(record.id); }}>
            <ReceiptText className="mr-2 h-4 w-4" />
            {t("payments.viewReceipt")}
          </Button>
        ) : undefined
      }
    />
  );
}
