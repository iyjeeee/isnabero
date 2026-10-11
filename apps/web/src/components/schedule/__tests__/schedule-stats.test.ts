import { describe, expect, it } from "vitest";
import type { Shift } from "@isnabero/module-scheduling";
import { computeWeekStats } from "../schedule-stats";

const shift = (employeeId: string, shiftDate: string, startTime: string, endTime: string): Shift => ({ id: `${employeeId}${shiftDate}${startTime}`, businessId: "b", employeeId, shiftDate, startTime, endTime, note: null });

describe("computeWeekStats", () => {
  it("is all zeros for an empty week", () => {
    const stats = computeWeekStats([]);
    expect(stats).toMatchObject({ shiftCount: 0, totalMinutes: 0, staffScheduled: 0 });
  });

  it("adds up hours per employee and counts distinct people per day", () => {
    const stats = computeWeekStats([
      shift("a", "2026-10-05", "09:00", "13:00"),
      shift("a", "2026-10-05", "14:00", "18:00"), // second shift the same day: still one person that day
      shift("b", "2026-10-05", "10:00", "18:30"),
      shift("b", "2026-10-06", "10:00", "12:00"),
    ]);
    expect(stats.shiftCount).toBe(4);
    expect(stats.totalMinutes).toBe(240 + 240 + 510 + 120);
    expect(stats.staffScheduled).toBe(2);
    expect(stats.minutesByEmployee.get("a")).toBe(480);
    expect(stats.minutesByEmployee.get("b")).toBe(630);
    expect(stats.staffByDay.get("2026-10-05")).toBe(2);
    expect(stats.staffByDay.get("2026-10-06")).toBe(1);
  });
});
