import { z } from "zod";
import { MAX_NOTE_LENGTH, toMinutes } from "@isnabero/module-scheduling";

// Field-level checks for the shift form; the repositories re-validate everything (and check overlaps) on save.
export const shiftFormSchema = z
  .object({
    employeeId: z.string().min(1, "Pick an employee"),
    shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
    startTime: z.string().refine((value) => toMinutes(value) !== null, "Enter a start time"),
    endTime: z.string().refine((value) => toMinutes(value) !== null, "Enter an end time"),
    note: z.string().trim().max(MAX_NOTE_LENGTH, `Keep it under ${MAX_NOTE_LENGTH} characters`).optional(),
  })
  .refine((values) => toMinutes(values.startTime) === null || toMinutes(values.endTime) === null || (toMinutes(values.endTime) as number) > (toMinutes(values.startTime) as number), {
    message: "The end time must be after the start time",
    path: ["endTime"],
  });

export type ShiftFormValues = z.infer<typeof shiftFormSchema>;
