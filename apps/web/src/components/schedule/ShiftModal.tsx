import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button, ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select } from "@isnabero/ui";
import { MAX_NOTE_LENGTH, useCreateShift, useDeleteShift, useUpdateShift, type Shift } from "@isnabero/module-scheduling";
import { supabase } from "@/lib/supabase";
import type { EmployeeView } from "@/lib/repositories/repository";
import { shiftFormSchema, type ShiftFormValues } from "./shift-form-schema";

// What the page asks the modal to do: add a shift (optionally pre-filled from a grid cell) or edit an existing one
export type ShiftEditorState = { mode: "add"; employeeId?: string; date: string } | { mode: "edit"; shift: Shift };

interface ShiftModalProps {
  businessId: string;
  state: ShiftEditorState | null; // null = closed
  employees: EmployeeView[];
  onClose: () => void;
}

const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";

const initialValues = (state: ShiftEditorState): ShiftFormValues =>
  state.mode === "edit"
    ? { employeeId: state.shift.employeeId, shiftDate: state.shift.shiftDate, startTime: state.shift.startTime, endTime: state.shift.endTime, note: state.shift.note ?? "" }
    : { employeeId: state.employeeId ?? "", shiftDate: state.date, startTime: DEFAULT_START, endTime: DEFAULT_END, note: "" };

// ShiftModal: add / edit / remove one shift. The employee of an existing shift is fixed (remove and re-add to reassign).
export function ShiftModal({ businessId, state, employees, onClose }: ShiftModalProps) {
  // Remount per target so the form starts from the right values every time it opens
  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      {state && <ShiftForm key={state.mode === "edit" ? state.shift.id : `add-${state.employeeId ?? ""}-${state.date}`} businessId={businessId} state={state} employees={employees} onClose={onClose} />}
    </Dialog>
  );
}

function ShiftForm({ businessId, state, employees, onClose }: Omit<ShiftModalProps, "state"> & { state: ShiftEditorState }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const createShift = useCreateShift(supabase, businessId);
  const updateShift = useUpdateShift(supabase, businessId);
  const deleteShift = useDeleteShift(supabase, businessId);
  const form = useForm<ShiftFormValues>({ resolver: zodResolver(shiftFormSchema), defaultValues: initialValues(state) });
  const { errors } = form.formState;
  const isEdit = state.mode === "edit";
  const isPending = createShift.isPending || updateShift.isPending;

  const onSubmit = form.handleSubmit((values) => {
    const done = (message: string) => ({
      onSuccess: () => {
        toast.success(message);
        onClose();
      },
    });
    if (state.mode === "edit") {
      updateShift.mutate({ shiftId: state.shift.id, input: { shiftDate: values.shiftDate, startTime: values.startTime, endTime: values.endTime, note: values.note ?? "" } }, done("Shift updated"));
    } else {
      createShift.mutate({ ...values, note: values.note ?? "" }, done("Shift added"));
    }
  });

  return (
    <>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit shift" : "Add shift"}</DialogTitle>
          <DialogDescription>Shifts stay within one day. For a night shift, add one shift per day.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="shift-employee">Employee</Label>
            <Select id="shift-employee" disabled={isEdit} aria-invalid={Boolean(errors.employeeId)} {...form.register("employeeId")}>
              <option value="">Select an employee…</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </Select>
            {errors.employeeId && <p className="text-xs text-destructive">{errors.employeeId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="shift-date">Date</Label>
            <Input id="shift-date" type="date" aria-invalid={Boolean(errors.shiftDate)} {...form.register("shiftDate")} />
            {errors.shiftDate && <p className="text-xs text-destructive">{errors.shiftDate.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="shift-start">Starts</Label>
              <Input id="shift-start" type="time" aria-invalid={Boolean(errors.startTime)} {...form.register("startTime")} />
              {errors.startTime && <p className="text-xs text-destructive">{errors.startTime.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shift-end">Ends</Label>
              <Input id="shift-end" type="time" aria-invalid={Boolean(errors.endTime)} {...form.register("endTime")} />
              {errors.endTime && <p className="text-xs text-destructive">{errors.endTime.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="shift-note">Note (optional)</Label>
            <Input id="shift-note" maxLength={MAX_NOTE_LENGTH} placeholder="e.g. Opens the shop" aria-invalid={Boolean(errors.note)} {...form.register("note")} />
            {errors.note && <p className="text-xs text-destructive">{errors.note.message}</p>}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {isEdit ? (
              <Button type="button" variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                Remove shift
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : isEdit ? "Save changes" : "Add shift"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      {state.mode === "edit" && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Remove this shift?"
          description="It disappears from the schedule. The change is recorded in the Audit Log."
          confirmLabel="Remove shift"
          isPending={deleteShift.isPending}
          onConfirm={() =>
            deleteShift.mutate(state.shift.id, {
              onSuccess: () => {
                toast.success("Shift removed");
                setConfirmDelete(false);
                onClose();
              },
            })
          }
        />
      )}
    </>
  );
}
