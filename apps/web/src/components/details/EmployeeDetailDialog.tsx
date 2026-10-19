import { Badge } from "@isnabero/ui";
import { useFormat, useLabels, useT } from "@/i18n";
import type { EmployeeView } from "@/lib/repositories/repository";
import { DetailDialog } from "./DetailDialog";

const ROLE_BADGE_VARIANT = { owner: "default", admin: "info", staff: "secondary" } as const;

interface EmployeeDetailDialogProps {
  employee: EmployeeView | null; // null = closed
  isYou: boolean;
  onClose: () => void;
}

export function EmployeeDetailDialog({ employee, isYou, onClose }: EmployeeDetailDialogProps) {
  const { t } = useT();
  const format = useFormat();
  const labels = useLabels();
  if (!employee) return null;
  const role = employee.role as keyof typeof ROLE_BADGE_VARIANT;
  const access = role === "owner" || role === "admin" || role === "staff" ? t(`details.access.${role}`) : null;
  return (
    <DetailDialog
      open
      onClose={onClose}
      title={employee.fullName}
      description={t("details.titles.employee")}
      badges={
        <>
          <Badge variant={ROLE_BADGE_VARIANT[role] ?? "secondary"}>{labels.role(employee.role)}</Badge>
          {isYou && <Badge variant="outline">{t("details.you")}</Badge>}
        </>
      }
      fields={[
        { label: t("details.fields.role"), value: labels.role(employee.role) },
        { label: t("details.fields.added"), value: format.date(employee.createdAt) },
        { label: t("details.fields.access"), value: access, wide: true },
      ]}
    />
  );
}
