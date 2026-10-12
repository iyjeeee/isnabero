import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, ActionIconButton } from "@isnabero/ui";
import { useT } from "@/i18n";
import { useDeleteEmployee } from "@/hooks/use-delete-employee";

interface DeleteEmployeeButtonProps {
  businessId: string;
  employeeId: string;
  employeeName: string;
}

export function DeleteEmployeeButton({ businessId, employeeId, employeeName }: DeleteEmployeeButtonProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const deleteEmployee = useDeleteEmployee(businessId);

  return (
    <>
      <ActionIconButton action="delete" icon={Trash2} onClick={() => setOpen(true)} aria-label={t("employees.remove.aria", { name: employeeName })} />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("employees.remove.title")}
        description={t("employees.remove.description", { name: employeeName })}
        confirmLabel={t("common.remove")}
        isPending={deleteEmployee.isPending}
        onConfirm={() =>
          deleteEmployee.mutate(employeeId, {
            onSuccess: () => {
              toast.success(t("employees.remove.removed", { name: employeeName }));
              setOpen(false);
            },
          })
        }
      />
    </>
  );
}
