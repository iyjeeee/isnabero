import { useFormat, useT } from "@/i18n";
import { formatPeso } from "@/lib/money";
import type { CashCloseView } from "@/lib/repositories/repository";
import { CashDifferenceBadge } from "@/components/cash/CashDifferenceBadge";
import { DetailDialog } from "./DetailDialog";

interface CashCloseDetailDialogProps {
  close: CashCloseView | null; // null = closed
  onClose: () => void;
}

export function CashCloseDetailDialog({ close, onClose }: CashCloseDetailDialogProps) {
  const { t } = useT();
  const format = useFormat();
  if (!close) return null;
  return (
    <DetailDialog
      open
      onClose={onClose}
      title={format.dateTime(close.periodEnd)}
      description={t("details.titles.cashClose")}
      badges={<CashDifferenceBadge difference={close.difference} />}
      fields={[
        { label: t("cashClose.current.startingCash"), value: formatPeso(close.openingFloat) },
        { label: t("cashClose.current.cashSales"), value: formatPeso(close.cashSales) },
        { label: t("cashClose.current.cashExpenses"), value: formatPeso(close.cashExpenses) },
        { label: t("cashClose.current.expected"), value: formatPeso(close.expected) },
        { label: t("cashClose.current.counted"), value: <span className="font-display text-lg font-bold">{formatPeso(close.counted)}</span> },
        { label: t("cashClose.detail.closedBy"), value: close.closedByName },
        { label: t("cashClose.detail.from"), value: format.dateTime(close.periodStart) },
        { label: t("cashClose.detail.to"), value: format.dateTime(close.periodEnd) },
        { label: t("cashClose.detail.note"), value: close.note, wide: true },
      ]}
    />
  );
}
