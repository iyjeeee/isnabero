import type { SupabaseClient } from "@supabase/supabase-js";
import type { SchedulingRepository } from "./repository";
import type { CopyWeekInput, CopyWeekResult, ListShiftsOptions, Shift, ShiftInput, UpdateShiftInput } from "./types";
import { addDays, weekStartOf } from "./dates";
import { normalizeShiftInput, normalizeShiftTimes, overlapMessage, shiftsOverlap } from "./validation";

// EXCLUSION_VIOLATION: the shifts_no_overlap constraint (migration 0008) — two shifts of one employee overlapped (e.g. a race)
const EXCLUSION_VIOLATION = "23P01";
const COLUMNS = "id, business_id, employee_id, shift_date, start_time, end_time, note";

// mapShiftRow: PostgREST returns time columns as "09:00:00"; the app works with "09:00"
function mapShiftRow(row: any): Shift {
  return { id: row.id, businessId: row.business_id, employeeId: row.employee_id, shiftDate: row.shift_date, startTime: String(row.start_time).slice(0, 5), endTime: String(row.end_time).slice(0, 5), note: row.note };
}

const overlapError = (error: { code?: string }) => (error.code === EXCLUSION_VIOLATION ? new Error("This overlaps an existing shift for the same employee.") : error);

// Audit entries are written by database triggers (migration 0008) — don't log here
export function createSupabaseSchedulingRepository(supabase: SupabaseClient): SchedulingRepository {
  // clashFor: an existing shift of the employee on that day that overlaps the candidate (friendlier than the constraint error)
  async function clashFor(businessId: string, employeeId: string, candidate: { shiftDate: string; startTime: string; endTime: string }, exceptId?: string) {
    let query = supabase.from("shifts").select(COLUMNS).eq("business_id", businessId).eq("employee_id", employeeId).eq("shift_date", candidate.shiftDate);
    if (exceptId) query = query.neq("id", exceptId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapShiftRow).find((shift) => shiftsOverlap(shift, candidate));
  }

  return {
    async listShifts(businessId, { from, to }: ListShiftsOptions) {
      const { data, error } = await supabase
        .from("shifts")
        .select(COLUMNS)
        .eq("business_id", businessId)
        .gte("shift_date", from)
        .lte("shift_date", to)
        .order("shift_date")
        .order("start_time");
      if (error) throw error;
      return (data ?? []).map(mapShiftRow);
    },

    async createShift(businessId, input: ShiftInput) {
      const clean = normalizeShiftInput(input);
      const clash = await clashFor(businessId, clean.employeeId, clean);
      if (clash) throw new Error(overlapMessage(clash));
      const { data, error } = await supabase
        .from("shifts")
        .insert({ business_id: businessId, employee_id: clean.employeeId, shift_date: clean.shiftDate, start_time: clean.startTime, end_time: clean.endTime, note: clean.note || null })
        .select(COLUMNS)
        .single();
      if (error) throw overlapError(error);
      return mapShiftRow(data);
    },

    async updateShift(businessId, shiftId, input: UpdateShiftInput) {
      const clean = normalizeShiftTimes(input);
      const { data: current, error: currentError } = await supabase.from("shifts").select("employee_id").eq("id", shiftId).eq("business_id", businessId).single();
      if (currentError) throw currentError;
      const clash = await clashFor(businessId, current.employee_id, clean, shiftId);
      if (clash) throw new Error(overlapMessage(clash));
      const { data, error } = await supabase
        .from("shifts")
        .update({ shift_date: clean.shiftDate, start_time: clean.startTime, end_time: clean.endTime, note: clean.note || null })
        .eq("id", shiftId)
        .eq("business_id", businessId)
        .select(COLUMNS)
        .single();
      if (error) throw overlapError(error);
      return mapShiftRow(data);
    },

    async deleteShift(businessId, shiftId) {
      const { error } = await supabase.from("shifts").delete().eq("id", shiftId).eq("business_id", businessId);
      if (error) throw error;
    },

    async copyWeek(businessId, { fromWeekStart, toWeekStart }: CopyWeekInput): Promise<CopyWeekResult> {
      const from = weekStartOf(fromWeekStart);
      const to = weekStartOf(toWeekStart);
      if (from === to) throw new Error("Pick a different week to copy into.");
      const offset = Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);

      const [sourceResult, targetResult] = await Promise.all([
        supabase.from("shifts").select(COLUMNS).eq("business_id", businessId).gte("shift_date", from).lte("shift_date", addDays(from, 6)),
        supabase.from("shifts").select(COLUMNS).eq("business_id", businessId).gte("shift_date", to).lte("shift_date", addDays(to, 6)),
      ]);
      if (sourceResult.error) throw sourceResult.error;
      if (targetResult.error) throw targetResult.error;
      const existing = (targetResult.data ?? []).map(mapShiftRow);

      const inserts: object[] = [];
      let skipped = 0;
      for (const shift of (sourceResult.data ?? []).map(mapShiftRow)) {
        const target = { shiftDate: addDays(shift.shiftDate, offset), startTime: shift.startTime, endTime: shift.endTime };
        if (existing.some((other) => other.employeeId === shift.employeeId && other.shiftDate === target.shiftDate && shiftsOverlap(other, target))) {
          skipped += 1;
          continue;
        }
        inserts.push({ business_id: businessId, employee_id: shift.employeeId, shift_date: target.shiftDate, start_time: target.startTime, end_time: target.endTime, note: shift.note });
      }
      if (inserts.length > 0) {
        const { error } = await supabase.from("shifts").insert(inserts);
        if (error) throw overlapError(error);
      }
      return { created: inserts.length, skipped };
    },
  };
}
