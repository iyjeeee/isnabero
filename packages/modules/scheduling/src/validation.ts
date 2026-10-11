import { isRealDate } from "./dates";
import type { Shift, ShiftInput, UpdateShiftInput } from "./types";

export const MAX_NOTE_LENGTH = 120;
export const MIN_SHIFT_MINUTES = 15;
export const MAX_SHIFT_MINUTES = 16 * 60;

// toMinutes: "09:30" -> 570, or null if it isn't a valid 24-hour HH:MM time
export function toMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

// shiftMinutes: length of a shift in minutes (0 if its times are invalid)
export function shiftMinutes(shift: Pick<Shift, "startTime" | "endTime">): number {
  const start = toMinutes(shift.startTime);
  const end = toMinutes(shift.endTime);
  return start === null || end === null ? 0 : Math.max(end - start, 0);
}

// shiftsOverlap: true when the two ranges share any time (touching end-to-start is fine)
export function shiftsOverlap(a: Pick<Shift, "startTime" | "endTime">, b: Pick<Shift, "startTime" | "endTime">): boolean {
  return a.startTime < b.endTime && b.startTime < a.endTime; // "HH:MM" strings compare correctly
}

// formatTimeRange: "09:00–17:00" (also how audit summaries write it)
export function formatTimeRange(shift: Pick<Shift, "startTime" | "endTime">): string {
  return `${shift.startTime}–${shift.endTime}`;
}

// formatClock: "13:05" -> "1:05 PM"
export function formatClock(time: string): string {
  const minutes = toMinutes(time);
  if (minutes === null) return time;
  const hours = Math.floor(minutes / 60);
  return `${hours % 12 === 0 ? 12 : hours % 12}:${String(minutes % 60).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

// formatClockShort: compact for the schedule grid — "9 AM", "1:30 PM" (minutes only when they matter)
export function formatClockShort(time: string): string {
  return formatClock(time).replace(":00 ", " ");
}

// formatHours: 480 -> "8h", 510 -> "8h 30m"
export function formatHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : hours === 0 ? `${rest}m` : `${hours}h ${rest}m`;
}

export function overlapMessage(clash: Pick<Shift, "startTime" | "endTime">): string {
  return `This overlaps an existing shift (${formatTimeRange(clash)}) for the same employee.`;
}

// normalizeShiftTimes: shared by both repositories — validates the date and times and trims the note
export function normalizeShiftTimes(input: UpdateShiftInput): Required<UpdateShiftInput> {
  if (!isRealDate(input.shiftDate)) throw new Error("Enter a valid date.");
  const start = toMinutes(input.startTime);
  const end = toMinutes(input.endTime);
  if (start === null || end === null) throw new Error("Enter valid start and end times.");
  if (end <= start) throw new Error("The end time must be after the start time. A shift can't run past midnight — add a second shift on the next day instead.");
  if (end - start < MIN_SHIFT_MINUTES) throw new Error(`A shift must be at least ${MIN_SHIFT_MINUTES} minutes long.`);
  if (end - start > MAX_SHIFT_MINUTES) throw new Error(`A shift can't be longer than ${MAX_SHIFT_MINUTES / 60} hours.`);
  const note = (input.note ?? "").trim();
  if (note.length > MAX_NOTE_LENGTH) throw new Error(`The note must be ${MAX_NOTE_LENGTH} characters or fewer.`);
  return { shiftDate: input.shiftDate, startTime: input.startTime, endTime: input.endTime, note };
}

export function normalizeShiftInput(input: ShiftInput): Required<ShiftInput> {
  if (!input.employeeId) throw new Error("Pick an employee.");
  return { employeeId: input.employeeId, ...normalizeShiftTimes(input) };
}
