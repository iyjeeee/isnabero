import { beforeEach, describe, expect, it } from "vitest";
import { mockDb, genId, auditRows, DEMO_BUSINESS_ID } from "@isnabero/db";
import { mockSchedulingRepository as repo } from "../mock-repository";
import { addDays, isRealDate, weekDays, weekStartOf } from "../dates";
import { formatClock, formatClockShort, formatHours, normalizeShiftInput, shiftMinutes, shiftsOverlap, toMinutes } from "../validation";

const employee = () => mockDb.employees.find((item) => item.fullName === "Ana Lopez")!;
const input = (overrides = {}) => ({ employeeId: employee().id, shiftDate: "2030-01-07", startTime: "09:00", endTime: "17:00", note: "", ...overrides });

// Each test starts with the far-future test days empty so the seeded weeks never interfere
beforeEach(() => {
  for (let index = mockDb.shifts.length - 1; index >= 0; index--) if (mockDb.shifts[index]!.shiftDate.startsWith("2030-")) mockDb.shifts.splice(index, 1);
});

describe("dates", () => {
  it("finds the Monday of a week and lists its seven days", () => {
    expect(weekStartOf("2026-10-11")).toBe("2026-10-05"); // a Sunday belongs to the week that started Monday
    expect(weekStartOf("2026-10-05")).toBe("2026-10-05");
    expect(weekDays("2026-10-07")).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
  });

  it("adds days across month and year ends and rejects impossible dates", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(isRealDate("2026-02-31")).toBe(false);
    expect(isRealDate("2026-2-3")).toBe(false);
  });
});

describe("shift rules", () => {
  it("parses times and measures shifts", () => {
    expect(toMinutes("09:30")).toBe(570);
    expect(toMinutes("24:00")).toBeNull();
    expect(toMinutes("9:30")).toBeNull();
    expect(shiftMinutes({ startTime: "09:00", endTime: "17:30" })).toBe(510);
    expect(formatClock("13:05")).toBe("1:05 PM");
    expect(formatClock("00:00")).toBe("12:00 AM");
    expect(formatClockShort("09:00")).toBe("9 AM");
    expect(formatClockShort("13:30")).toBe("1:30 PM");
    expect(formatHours(510)).toBe("8h 30m");
    expect(formatHours(480)).toBe("8h");
  });

  it("treats touching shifts as fine and shared time as an overlap", () => {
    expect(shiftsOverlap({ startTime: "09:00", endTime: "13:00" }, { startTime: "13:00", endTime: "17:00" })).toBe(false);
    expect(shiftsOverlap({ startTime: "09:00", endTime: "13:01" }, { startTime: "13:00", endTime: "17:00" })).toBe(true);
  });

  it("rejects bad input", () => {
    expect(() => normalizeShiftInput(input({ employeeId: "" }))).toThrow(/employee/);
    expect(() => normalizeShiftInput(input({ shiftDate: "2030-02-31" }))).toThrow(/valid date/);
    expect(() => normalizeShiftInput(input({ startTime: "9am" }))).toThrow(/valid start and end/);
    expect(() => normalizeShiftInput(input({ startTime: "17:00", endTime: "09:00" }))).toThrow(/after the start/);
    expect(() => normalizeShiftInput(input({ startTime: "09:00", endTime: "09:10" }))).toThrow(/at least 15/);
    expect(() => normalizeShiftInput(input({ startTime: "00:00", endTime: "17:00" }))).toThrow(/longer than 16/);
    expect(() => normalizeShiftInput(input({ note: "x".repeat(121) }))).toThrow(/120/);
  });
});

describe("mockSchedulingRepository", () => {
  it("creates, lists in order and audits a shift", async () => {
    await repo.createShift(DEMO_BUSINESS_ID, input({ startTime: "13:00", endTime: "17:00", note: "  PM  " }));
    await repo.createShift(DEMO_BUSINESS_ID, input({ startTime: "08:00", endTime: "12:00" }));
    const list = await repo.listShifts(DEMO_BUSINESS_ID, { from: "2030-01-07", to: "2030-01-07" });
    expect(list.map((shift) => shift.startTime)).toEqual(["08:00", "13:00"]);
    expect(list[1]!.note).toBe("PM");
    const entry = auditRows.find((row) => row.action === "shift.created" && row.summary.includes("2030-01-07 13:00–17:00"));
    expect(entry?.summary).toBe("Scheduled Ana Lopez on 2030-01-07 13:00–17:00");
    expect(entry?.entityType).toBe("shift");
  });

  it("refuses an overlapping shift for the same employee but allows other employees and touching times", async () => {
    await repo.createShift(DEMO_BUSINESS_ID, input());
    await expect(repo.createShift(DEMO_BUSINESS_ID, input({ startTime: "16:00", endTime: "20:00" }))).rejects.toThrow(/overlaps/);
    await repo.createShift(DEMO_BUSINESS_ID, input({ startTime: "17:00", endTime: "20:00" }));
    const other = mockDb.employees.find((item) => item.fullName === "Pedro Reyes")!;
    await repo.createShift(DEMO_BUSINESS_ID, input({ employeeId: other.id }));
  });

  it("rejects an employee from another business", async () => {
    await expect(repo.createShift(DEMO_BUSINESS_ID, input({ employeeId: genId() }))).rejects.toThrow(/employee/);
  });

  it("updates times (audited) and ignores itself when checking overlaps; a note-only edit isn't audited", async () => {
    const shift = await repo.createShift(DEMO_BUSINESS_ID, input());
    const logged = auditRows.length;
    await repo.updateShift(DEMO_BUSINESS_ID, shift.id, { shiftDate: "2030-01-07", startTime: "09:00", endTime: "18:00", note: "" });
    expect(auditRows.length).toBe(logged + 1);
    expect(auditRows.find((row) => row.action === "shift.updated")?.summary).toBe("Changed shift for Ana Lopez: 2030-01-07 09:00–17:00 → 2030-01-07 09:00–18:00");
    await repo.updateShift(DEMO_BUSINESS_ID, shift.id, { shiftDate: "2030-01-07", startTime: "09:00", endTime: "18:00", note: "Cover" });
    expect(auditRows.length).toBe(logged + 1);
  });

  it("refuses to move a shift onto another of the same employee's shifts", async () => {
    await repo.createShift(DEMO_BUSINESS_ID, input({ startTime: "09:00", endTime: "12:00" }));
    const second = await repo.createShift(DEMO_BUSINESS_ID, input({ startTime: "13:00", endTime: "17:00" }));
    await expect(repo.updateShift(DEMO_BUSINESS_ID, second.id, { shiftDate: "2030-01-07", startTime: "11:00", endTime: "15:00", note: "" })).rejects.toThrow(/overlaps/);
  });

  it("deletes (audited) and reports an unknown shift", async () => {
    const shift = await repo.createShift(DEMO_BUSINESS_ID, input());
    await repo.deleteShift(DEMO_BUSINESS_ID, shift.id);
    expect(await repo.listShifts(DEMO_BUSINESS_ID, { from: "2030-01-07", to: "2030-01-07" })).toHaveLength(0);
    expect(auditRows.find((row) => row.action === "shift.deleted")?.summary).toBe("Removed Ana Lopez's shift on 2030-01-07 09:00–17:00");
    await expect(repo.deleteShift(DEMO_BUSINESS_ID, shift.id)).rejects.toThrow(/not found/);
  });

  it("copies a week, skips what would overlap, and refuses the same week", async () => {
    await repo.createShift(DEMO_BUSINESS_ID, input()); // Mon 2030-01-07
    await repo.createShift(DEMO_BUSINESS_ID, input({ shiftDate: "2030-01-09", startTime: "10:00", endTime: "14:00", note: "Open" }));
    // next week already has an overlapping Monday shift for the same employee
    await repo.createShift(DEMO_BUSINESS_ID, input({ shiftDate: "2030-01-14", startTime: "12:00", endTime: "16:00" }));
    const result = await repo.copyWeek(DEMO_BUSINESS_ID, { fromWeekStart: "2030-01-09", toWeekStart: "2030-01-16" });
    expect(result).toEqual({ created: 1, skipped: 1 });
    const copied = await repo.listShifts(DEMO_BUSINESS_ID, { from: "2030-01-16", to: "2030-01-16" });
    expect(copied).toHaveLength(1);
    expect(copied[0]).toMatchObject({ shiftDate: "2030-01-16", startTime: "10:00", note: "Open" });
    await expect(repo.copyWeek(DEMO_BUSINESS_ID, { fromWeekStart: "2030-01-07", toWeekStart: "2030-01-11" })).rejects.toThrow(/different week/);
  });

  it("has seeded shifts for this week and next", async () => {
    const monday = weekStartOf(new Date().toLocaleDateString("en-CA"));
    const list = await repo.listShifts(DEMO_BUSINESS_ID, { from: monday, to: addDays(monday, 13) });
    expect(list.length).toBeGreaterThan(20);
    expect(new Set(list.map((shift) => shift.employeeId)).size).toBe(4);
  });
});
