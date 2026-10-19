import type { Expense } from "@isnabero/module-expenses";
import { Badge } from "@isnabero/ui";
import { useFormat, useLabels, useT } from "@/i18n";
import { formatPeso } from "@/lib/money";
import { DetailDialog } from "./DetailDialog";

interface ExpenseDetailDialogProps {
  expense: Expense | null; // null = closed
  recordedByName: string | null;
  onClose: () => void;
}

export function ExpenseDetailDialog({ expense, recordedByName, onClose }: ExpenseDetailDialogProps) {
  const { t } = useT();
  const format = useFormat();
  const labels = useLabels();
  if (!expense) return null;
  return (
    <DetailDialog
      open
      onClose={onClose}
      title={expense.description}
      description={t("details.titles.expense")}
      badges={
        <>
          <Badge variant="secondary">{labels.expenseCategory(expense.category)}</Badge>
          {expense.voidedAt ? <Badge variant="destructive">{t("expenses.voided")}</Badge> : <Badge variant="success">{t("details.active")}</Badge>}
        </>
      }
      fields={[
        { label: t("details.fields.amount"), value: <span className="font-display text-lg font-bold">{formatPeso(expense.amount)}</span> },
        { label: t("details.fields.expenseDate"), value: format.date(expense.expenseDate) },
        { label: t("details.fields.category"), value: labels.expenseCategory(expense.category) },
        { label: t("details.fields.method"), value: labels.method(expense.method) },
        { label: t("details.fields.recordedBy"), value: recordedByName },
        { label: t("details.fields.recordedOn"), value: format.dateTime(expense.createdAt) },
        { label: t("details.fields.notes"), value: expense.notes, wide: true },
        ...(expense.voidedAt ? [{ label: t("details.voidedOn"), value: format.dateTime(expense.voidedAt) }] : []),
      ]}
    />
  );
}
