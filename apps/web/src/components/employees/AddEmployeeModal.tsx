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
import { useCreateEmployee } from "@/hooks/use-create-employee";
import { useQueryClient } from "@tanstack/react-query";

const employeeFormSchema = z.object({
  fullName: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  role: z.enum(["owner", "admin", "staff"]),
});

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

interface AddEmployeeModalProps {
  businessId: string;
}

export function AddEmployeeModal({ businessId }: AddEmployeeModalProps) {
  const [open, setOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const createEmployee = useCreateEmployee(businessId);
  const queryClient = useQueryClient();

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: { fullName: "", email: "", role: "staff" },
  });

  const isSupabaseMode = getDataSource() === "supabase";

  const onSubmit = form.handleSubmit(async (values) => {
    if (isSupabaseMode) {
      // Real invite: calls the invite-employee Edge Function, which creates an actual auth.users row
      // via the admin API (something the browser can never do directly with just the anon key) and the
      // matching employees row together. See supabase/functions/invite-employee/index.ts.
      setIsInviting(true);
      const { error } = await supabase.functions.invoke("invite-employee", {
        body: { businessId, email: values.email, fullName: values.fullName, role: values.role },
      });
      setIsInviting(false);
      if (error) {
        toast.error(`Couldn't invite ${values.fullName}: ${error.message}`);
        return;
      }
      toast.success(`Invited ${values.fullName} — they'll get an email to set their password`);
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
          toast.success(`${values.fullName} added to the team`);
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
        Add Employee
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isSupabaseMode ? "Invite employee" : "Add employee"}</DialogTitle>
          <DialogDescription>
            {isSupabaseMode
              ? "Sends a real invite email so this person can set their own password and sign in."
              : "Mock mode: creates a local record only — no real login is created."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" placeholder="e.g. Maria Santos" {...form.register("fullName")} />
            {form.formState.errors.fullName && (
              <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="maria@example.com" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select id="role" {...form.register("role")}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (isSupabaseMode ? "Sending invite…" : "Adding…") : isSupabaseMode ? "Send invite" : "Add employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
