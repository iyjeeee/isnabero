import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog, ActionIconButton } from "@isnabero/ui";
import { useDeleteEmployee } from "@/hooks/use-delete-employee";

interface DeleteEmployeeButtonProps {
  businessId: string;
  employeeId: string;
  employeeName: string;
}

export function DeleteEmployeeButton({ businessId, employeeId, employeeName }: DeleteEmployeeButtonProps) {
  const [open, setOpen] = useState(false);
  const deleteEmployee = useDeleteEmployee(businessId);

  return (
    <>
      <ActionIconButton action="delete" icon={Trash2} onClick={() => setOpen(true)} aria-label={`Remove ${employeeName}`} />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Remove employee?"
        description={`This removes ${employeeName} from this business. This can't be undone.`}
        confirmLabel="Remove"
        isPending={deleteEmployee.isPending}
        onConfirm={() =>
          deleteEmployee.mutate(employeeId, {
            onSuccess: () => {
              toast.success(`${employeeName} removed`);
              setOpen(false);
            },
          })
        }
      />
    </>
  );
}
