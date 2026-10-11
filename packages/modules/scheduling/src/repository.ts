import type { CopyWeekInput, CopyWeekResult, ListShiftsOptions, Shift, ShiftInput, UpdateShiftInput } from "./types";

// SchedulingRepository: data-access contract for shifts. Both implementations enforce the same rules: valid date/times,
// no overlapping shifts for one employee, and the employee must belong to the business.
export interface SchedulingRepository {
  listShifts(businessId: string, options: ListShiftsOptions): Promise<Shift[]>; // by date, then start time
  createShift(businessId: string, input: ShiftInput): Promise<Shift>;
  updateShift(businessId: string, shiftId: string, input: UpdateShiftInput): Promise<Shift>;
  deleteShift(businessId: string, shiftId: string): Promise<void>;
  // copyWeek: repeats one week's shifts in another week (same weekday and times); overlapping ones are skipped, not failed
  copyWeek(businessId: string, input: CopyWeekInput): Promise<CopyWeekResult>;
}
