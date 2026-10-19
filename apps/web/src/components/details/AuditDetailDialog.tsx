import { Badge } from "@isnabero/ui";
import { useFormat, useLabels, useT } from "@/i18n";
import type { AuditLogEntry } from "@/lib/repositories/repository";
import { DetailDialog } from "./DetailDialog";

interface AuditDetailDialogProps {
  entry: AuditLogEntry | null; // null = closed
  onClose: () => void;
}

export function AuditDetailDialog({ entry, onClose }: AuditDetailDialogProps) {
  const { t } = useT();
  const format = useFormat();
  const labels = useLabels();
  if (!entry) return null;
  return (
    <DetailDialog
      open
      onClose={onClose}
      title={labels.auditAction(entry.action)}
      description={t("details.titles.audit")}
      badges={<Badge variant="secondary">{labels.auditEntity(entry.entityType)}</Badge>}
      fields={[
        { label: t("details.fields.when"), value: format.dateTime(entry.createdAt) },
        { label: t("details.fields.who"), value: entry.actorName },
        { label: t("details.fields.summary"), value: entry.summary, wide: true },
      ]}
    />
  );
}
