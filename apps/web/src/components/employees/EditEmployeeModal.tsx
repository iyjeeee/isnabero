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
import { useUpdateEmployee } from "@/hooks/use-update-employee";
import type { EmployeeView } from "@/lib/repositories/repository";

const employeeFormSchema = z.object({
  fullName: z.string().min(1, "Name is required"),
  role: z.enum(["owner", "admin", "staff"]),
});

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

interface EditEmployeeModalProps {
  businessId: string;
  employee: EmployeeView;
}

export function EditEmployeeModal({ businessId, employee }: EditEmployeeModalProps) {
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
          toast.success(`${values.fullName} updated`);
          setOpen(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) form.reset({ fullName: employee.fullName, role: employee.role as EmployeeFormValues["role"] }); }}>
      <ActionIconButton action="edit" icon={Pencil} onClick={() => setOpen(true)} aria-label={`Edit ${employee.fullName}`} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit employee</DialogTitle>
          <DialogDescription>Update this employee's name or role.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-fullName">Full name</Label>
            <Input id="edit-fullName" {...form.register("fullName")} />
            {form.formState.errors.fullName && (
              <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-role">Role</Label>
            <Select id="edit-role" {...form.register("role")}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateEmployee.isPending}>
              {updateEmployee.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
