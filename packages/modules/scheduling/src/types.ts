// Shift: one employee's planned work block on one calendar day (wall-clock times, no timezone)
export interface Shift {
  id: string;
  businessId: string;
  employeeId: string;
  shiftDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM, 24-hour
  endTime: string; // HH:MM, 24-hour, always after startTime
  note: string | null;
}

export interface ShiftInput {
  employeeId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  note?: string;
}

// An existing shift keeps its employee; to reassign it, remove it and add a new one
export type UpdateShiftInput = Omit<ShiftInput, "employeeId">;

export interface ListShiftsOptions {
  from: string; // YYYY-MM-DD, inclusive
  to: string; // YYYY-MM-DD, inclusive
}

export interface CopyWeekInput {
  fromWeekStart: string; // any date in the week to copy from
  toWeekStart: string; // any date in the week to copy into
}

export interface CopyWeekResult {
  created: number;
  skipped: number; // shifts left out because they would overlap one that is already there
}
