import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
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
} from "@isnabero/ui";
import { getDataSource } from "@isnabero/db";
import { supabase } from "@/lib/supabase";
import { msg, useLabels, useT } from "@/i18n";
import { inviteErrorMessage } from "@/lib/invite-error";
import { useCreateEmployee } from "@/hooks/use-create-employee";
import { useQueryClient } from "@tanstack/react-query";

const baseEmployeeFields = {
  fullName: z.string().trim().min(1, msg("employees.form.nameRequired")),
  role: z.enum(["owner", "admin", "staff"]),
};
// Email is only used by the real invite flow (supabase mode); mock mode creates a local record without one
const inviteFormSchema = z.object({ ...baseEmployeeFields, email: z.string().email(msg("employees.form.emailInvalid")) });
const mockFormSchema = z.object({ ...baseEmployeeFields, email: z.string().optional() });

type EmployeeFormValues = z.infer<typeof inviteFormSchema>;

interface AddEmployeeModalProps {
  businessId: string;
}

export function AddEmployeeModal({ businessId }: AddEmployeeModalProps) {
  const { t, tm } = useT();
  const labels = useLabels();
  const [open, setOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const createEmployee = useCreateEmployee(businessId);
  const queryClient = useQueryClient();

  const isSupabaseMode = getDataSource() === "supabase";

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(isSupabaseMode ? inviteFormSchema : mockFormSchema),
    defaultValues: { fullName: "", email: "", role: "staff" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (isSupabaseMode) {
      // Real invite: calls the invite-employee Edge Function, which creates an actual auth.users row
      // via the admin API (something the browser can never do directly with just the anon key) and the
      // matching employees row together. See supabase/functions/invite-employee/index.ts.
      setIsInviting(true);
      const { error } = await supabase.functions.invoke("invite-employee", {
        body: { businessId, email: values.email, fullName: values.fullName, role: values.role },
      });
      if (error) {
        setIsInviting(false);
        toast.error(t("employees.add.inviteFailed", { name: values.fullName, error: await inviteErrorMessage(error) }));
        return;
      }
      setIsInviting(false);
      toast.success(t("employees.add.invited", { name: values.fullName }));
      queryClient.invalidateQueries({ queryKey: ["employees", businessId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats", businessId] });
      form.reset();
      setOpen(false);
      return;
    }

    // Mock mode: no real backend to invite through, so this just creates the record directly.
    createEmployee.mutate(
      { fullName: values.fullName, role: values.role },
      {
        onSuccess: () => {
          toast.success(t("employees.add.added", { name: values.fullName }));
          form.reset();
          setOpen(false);
        },
      },
    );
  });

  const isPending = isSupabaseMode ? isInviting : createEmployee.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />
        {t("employees.add.button")}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isSupabaseMode ? t("employees.add.inviteTitle") : t("employees.add.addTitle")}</DialogTitle>
          <DialogDescription>
            {isSupabaseMode ? t("employees.add.inviteDescription") : t("employees.add.addDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">{t("employees.form.fullName")}</Label>
            <Input id="fullName" placeholder={t("employees.form.fullNamePlaceholder")} {...form.register("fullName")} />
            {form.formState.errors.fullName && (
              <p className="text-xs text-destructive">{tm(form.formState.errors.fullName.message)}</p>
            )}
          </div>

          {isSupabaseMode && (
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" type="email" placeholder={t("employees.form.emailPlaceholder")} {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{tm(form.formState.errors.email.message)}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="role">{t("employees.form.role")}</Label>
            <Select id="role" {...form.register("role")}>
              <option value="staff">{labels.role("staff")}</option>
              <option value="admin">{labels.role("admin")}</option>
              <option value="owner">{labels.role("owner")}</option>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isSupabaseMode ? t("employees.add.pendingInvite") : t("employees.add.pendingAdd")
                : isSupabaseMode ? t("employees.add.submitInvite") : t("employees.add.submitAdd")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
