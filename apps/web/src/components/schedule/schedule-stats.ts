import { shiftMinutes, type Shift } from "@isnabero/module-scheduling";

export interface WeekStats {
  shiftCount: number;
  totalMinutes: number;
  staffScheduled: number; // distinct employees with at least one shift
  minutesByEmployee: Map<string, number>;
  staffByDay: Map<string, number>; // distinct employees working each day
}

// computeWeekStats: totals for the shifts shown on the schedule (pure, so it's unit-tested)
export function computeWeekStats(shifts: Shift[]): WeekStats {
  const minutesByEmployee = new Map<string, number>();
  const staffOnDay = new Map<string, Set<string>>();
  let totalMinutes = 0;
  for (const shift of shifts) {
    const minutes = shiftMinutes(shift);
    totalMinutes += minutes;
    minutesByEmployee.set(shift.employeeId, (minutesByEmployee.get(shift.employeeId) ?? 0) + minutes);
    const set = staffOnDay.get(shift.shiftDate) ?? new Set<string>();
    set.add(shift.employeeId);
    staffOnDay.set(shift.shiftDate, set);
  }
  return {
    shiftCount: shifts.length,
    totalMinutes,
    staffScheduled: minutesByEmployee.size,
    minutesByEmployee,
    staffByDay: new Map([...staffOnDay].map(([day, set]) => [day, set.size])),
  };
}
