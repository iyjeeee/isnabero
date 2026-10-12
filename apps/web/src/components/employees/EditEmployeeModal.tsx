import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Label,
  Select,
  ActionIconButton,
} from "@isnabero/ui";
import { msg, useLabels, useT } from "@/i18n";
import { useUpdateEmployee } from "@/hooks/use-update-employee";
import type { EmployeeView } from "@/lib/repositories/repository";

const employeeFormSchema = z.object({
  fullName: z.string().min(1, msg("employees.form.nameRequired")),
  role: z.enum(["owner", "admin", "staff"]),
});

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

interface EditEmployeeModalProps {
  businessId: string;
  employee: EmployeeView;
}

export function EditEmployeeModal({ businessId, employee }: EditEmployeeModalProps) {
  const { t, tm } = useT();
  const labels = useLabels();
  const [open, setOpen] = useState(false);
  const updateEmployee = useUpdateEmployee(businessId);

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: { fullName: employee.fullName, role: employee.role as EmployeeFormValues["role"] },
  });

  const onSubmit = form.handleSubmit((values) => {
    updateEmployee.mutate(
      { employeeId: employee.id, input: values },
      {
        onSuccess: () => {
          toast.success(t("employees.edit.updated", { name: values.fullName }));
          setOpen(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) form.reset({ fullName: employee.fullName, role: employee.role as EmployeeFormValues["role"] }); }}>
      <ActionIconButton action="edit" icon={Pencil} onClick={() => setOpen(true)} aria-label={t("employees.edit.aria", { name: employee.fullName })} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("employees.edit.title")}</DialogTitle>
          <DialogDescription>{t("employees.edit.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-fullName">{t("employees.form.fullName")}</Label>
            <Input id="edit-fullName" {...form.register("fullName")} />
            {form.formState.errors.fullName && (
              <p className="text-xs text-destructive">{tm(form.formState.errors.fullName.message)}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-role">{t("employees.form.role")}</Label>
            <Select id="edit-role" {...form.register("role")}>
              <option value="staff">{labels.role("staff")}</option>
              <option value="admin">{labels.role("admin")}</option>
              <option value="owner">{labels.role("owner")}</option>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={updateEmployee.isPending}>
              {updateEmployee.isPending ? t("common.saving") : t("employees.edit.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
