import { z } from "zod";
import { msg } from "@/i18n";
import { MAX_NOTE_LENGTH, toMinutes } from "@isnabero/module-scheduling";

// Field-level checks for the shift form; the repositories re-validate everything (and check overlaps) on save.
export const shiftFormSchema = z
  .object({
    employeeId: z.string().min(1, msg("schedule.form.pickEmployee")),
    shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg("schedule.form.chooseDate")),
    startTime: z.string().refine((value) => toMinutes(value) !== null, msg("schedule.form.startTime")),
    endTime: z.string().refine((value) => toMinutes(value) !== null, msg("schedule.form.endTime")),
    note: z.string().trim().max(MAX_NOTE_LENGTH, msg("schedule.form.keepUnder", { max: MAX_NOTE_LENGTH })).optional(),
  })
  .refine((values) => toMinutes(values.startTime) === null || toMinutes(values.endTime) === null || (toMinutes(values.endTime) as number) > (toMinutes(values.startTime) as number), {
    message: msg("schedule.form.endAfterStart"),
    path: ["endTime"],
  });

export type ShiftFormValues = z.infer<typeof shiftFormSchema>;
