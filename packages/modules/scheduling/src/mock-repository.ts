import { mockDb, delay, genId, recordAudit } from "@isnabero/db";
import type { SchedulingRepository } from "./repository";
import type { CopyWeekInput, CopyWeekResult, ListShiftsOptions, Shift, ShiftInput, UpdateShiftInput } from "./types";
import { addDays, weekStartOf } from "./dates";
import { formatTimeRange, normalizeShiftInput, normalizeShiftTimes, overlapMessage, shiftsOverlap } from "./validation";

type ShiftRow = (typeof mockDb.shifts)[number];

function toShift(row: ShiftRow): Shift {
  return { id: row.id, businessId: row.businessId, employeeId: row.employeeId, shiftDate: row.shiftDate, startTime: row.startTime, endTime: row.endTime, note: row.note };
}

const employeeName = (employeeId: string) => mockDb.employees.find((employee) => employee.id === employeeId)?.fullName ?? "Unknown employee";

function findShift(businessId: string, shiftId: string): ShiftRow {
  const row = mockDb.shifts.find((item) => item.id === shiftId && item.businessId === businessId);
  if (!row) throw new Error("Shift not found.");
  return row;
}

// clashWith: an existing shift of the same employee on the same day that overlaps the candidate (ignoring `exceptId`)
function clashWith(businessId: string, employeeId: string, candidate: { shiftDate: string; startTime: string; endTime: string }, exceptId?: string) {
  return mockDb.shifts.find((row) => row.businessId === businessId && row.employeeId === employeeId && row.shiftDate === candidate.shiftDate && row.id !== exceptId && shiftsOverlap(row, candidate));
}

// Audit wording mirrors the Supabase triggers in migration 0008
const scheduledSummary = (row: ShiftRow) => `Scheduled ${employeeName(row.employeeId)} on ${row.shiftDate} ${formatTimeRange(row)}`;

function insertShift(businessId: string, input: Required<ShiftInput>): ShiftRow {
  const row: ShiftRow = { id: genId(), businessId, ...input, note: input.note || null, createdAt: new Date() };
  mockDb.shifts.push(row);
  recordAudit({ businessId, action: "shift.created", entityId: row.id, summary: scheduledSummary(row) });
  return row;
}

export const mockSchedulingRepository: SchedulingRepository = {
  async listShifts(businessId, { from, to }: ListShiftsOptions) {
    await delay();
    return mockDb.shifts
      .filter((row) => row.businessId === businessId && row.shiftDate >= from && row.shiftDate <= to)
      .sort((a, b) => a.shiftDate.localeCompare(b.shiftDate) || a.startTime.localeCompare(b.startTime))
      .map(toShift);
  },

  async createShift(businessId, input: ShiftInput) {
    await delay(250);
    const clean = normalizeShiftInput(input);
    if (!mockDb.employees.some((employee) => employee.id === clean.employeeId && employee.businessId === businessId)) throw new Error("Pick an employee.");
    const clash = clashWith(businessId, clean.employeeId, clean);
    if (clash) throw new Error(overlapMessage(clash));
    return toShift(insertShift(businessId, clean));
  },

  async updateShift(businessId, shiftId, input: UpdateShiftInput) {
    await delay(250);
    const row = findShift(businessId, shiftId);
    const clean = normalizeShiftTimes(input);
    const clash = clashWith(businessId, row.employeeId, clean, row.id);
    if (clash) throw new Error(overlapMessage(clash));
    const before = { date: row.shiftDate, range: formatTimeRange(row) };
    Object.assign(row, { shiftDate: clean.shiftDate, startTime: clean.startTime, endTime: clean.endTime, note: clean.note || null });
    // Only a change of day or time is audited (a note edit isn't), like the trigger
    if (before.date !== row.shiftDate || before.range !== formatTimeRange(row)) {
      recordAudit({ businessId, action: "shift.updated", entityId: row.id, summary: `Changed shift for ${employeeName(row.employeeId)}: ${before.date} ${before.range} → ${row.shiftDate} ${formatTimeRange(row)}` });
    }
    return toShift(row);
  },

  async deleteShift(businessId, shiftId) {
    await delay(200);
    const row = findShift(businessId, shiftId);
    mockDb.shifts.splice(mockDb.shifts.indexOf(row), 1);
    recordAudit({ businessId, action: "shift.deleted", entityId: row.id, summary: `Removed ${employeeName(row.employeeId)}'s shift on ${row.shiftDate} ${formatTimeRange(row)}` });
  },

  async copyWeek(businessId, { fromWeekStart, toWeekStart }: CopyWeekInput): Promise<CopyWeekResult> {
    await delay(300);
    const from = weekStartOf(fromWeekStart);
    const to = weekStartOf(toWeekStart);
    if (from === to) throw new Error("Pick a different week to copy into.");
    const offset = Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
    const source = mockDb.shifts.filter((row) => row.businessId === businessId && row.shiftDate >= from && row.shiftDate <= addDays(from, 6));
    let created = 0;
    let skipped = 0;
    for (const row of source) {
      const target = { shiftDate: addDays(row.shiftDate, offset), startTime: row.startTime, endTime: row.endTime };
      if (clashWith(businessId, row.employeeId, target)) {
        skipped += 1;
        continue;
      }
      insertShift(businessId, { employeeId: row.employeeId, ...target, note: row.note ?? "" });
      created += 1;
    }
    return { created, skipped };
  },
};
