import { beforeAll, describe, expect, it } from "vitest";
import { BookingStatusError } from "../../../packages/modules/booking/src/status";
import { getContext, repos, tag, type TestContext } from "./harness";

let ctx: TestContext;
let r: ReturnType<typeof repos>;
let service: Awaited<ReturnType<ReturnType<typeof repos>["catalog"]["createOfferingWithInclusions"]>>;
// a random far-future stretch of days per run, so re-runs never collide with leftovers or real data
const RUN_DAY = Math.floor(Math.random() * 20_000);
const day = (offset: number) => new Date(Date.UTC(2040, 0, 1 + RUN_DAY + offset));
const ymd = (date: Date) => date.toISOString().slice(0, 10);
const monday = (() => { const d = day(0); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7)); return d; })(); // first Monday on/after the run day
const plus = (days: number) => ymd(new Date(monday.getTime() + days * 86_400_000));
const slot = (offset: number, hour: number, hours = 1) => ({ startTime: new Date(day(offset).getTime() + hour * 3600_000), endTime: new Date(day(offset).getTime() + (hour + hours) * 3600_000) });
const book = (offset: number, hour: number) => r.booking.createBooking(ctx.businessId, { offeringId: service.id, mode: "appointment", customerName: tag("Customer"), customerContact: "0917", ...slot(offset, hour) });

beforeAll(async () => {
  ctx = await getContext();
  r = repos(ctx.owner.client);
  service = await r.catalog.createOfferingWithInclusions(ctx.businessId, { offering: { name: tag("Session"), description: null, type: "item", price: "500.00", durationMinutes: 60, isAvailable: true, barcode: null }, inclusions: [] });
});

describe("booking", () => {
  it("creates a pending booking that shows in the calendar range", async () => {
    const made = await book(0, 9);
    expect(made.status).toBe("pending");
    const listed = await r.booking.listBookings(ctx.businessId, day(0).toISOString(), day(1).toISOString());
    expect(listed.some((row) => row.id === made.id && row.offering.id === service.id)).toBe(true);
  });

  it("refuses an overlapping slot but allows back-to-back, and editing a booking ignores itself", async () => {
    const first = await book(2, 9);
    await expect(book(2, 9)).rejects.toThrow();
    await expect(r.booking.createBooking(ctx.businessId, { offeringId: service.id, mode: "appointment", customerName: tag("Late"), customerContact: null, ...slot(2, 9.5) })).rejects.toThrow();
    const next = await book(2, 10);
    expect(next.id).not.toBe(first.id);
    const moved = await r.booking.updateBooking(ctx.businessId, first.id, { offeringId: service.id, customerName: first.customerName, customerContact: null, ...slot(2, 9, 1) });
    expect(moved.id).toBe(first.id);
  });

  it("follows the status lifecycle and locks final states", async () => {
    const made = await book(4, 9);
    await expect(r.booking.updateBookingStatus(ctx.businessId, made.id, "completed")).rejects.toBeInstanceOf(BookingStatusError);
    expect((await r.booking.updateBookingStatus(ctx.businessId, made.id, "confirmed")).status).toBe("confirmed");
    expect((await r.booking.updateBookingStatus(ctx.businessId, made.id, "completed")).status).toBe("completed");
    await expect(r.booking.updateBookingStatus(ctx.businessId, made.id, "cancelled")).rejects.toThrow();
    await expect(r.booking.updateBooking(ctx.businessId, made.id, { offeringId: service.id, customerName: "x", customerContact: null, ...slot(4, 9) })).rejects.toThrow();
  });

  it("frees the slot when a booking is cancelled", async () => {
    const made = await book(6, 9);
    await r.booking.updateBookingStatus(ctx.businessId, made.id, "cancelled");
    expect((await book(6, 9)).status).toBe("pending");
  });
});

describe("scheduling", () => {
  const shift = (date: string, start: string, end: string) => ({ employeeId: ctx.ownerEmployeeId, shiftDate: date, startTime: start, endTime: end, note: "e2e" });

  it("creates, lists, edits and deletes a shift; refuses overlaps and bad times", async () => {
    const made = await r.scheduling.createShift(ctx.businessId, shift(plus(0), "09:00", "13:00"));
    expect((await r.scheduling.listShifts(ctx.businessId, { from: plus(0), to: plus(0) })).map((row) => row.id)).toContain(made.id);
    await expect(r.scheduling.createShift(ctx.businessId, shift(plus(0), "12:00", "15:00"))).rejects.toThrow();
    await expect(r.scheduling.createShift(ctx.businessId, shift(plus(0), "15:00", "14:00"))).rejects.toThrow();
    const edited = await r.scheduling.updateShift(ctx.businessId, made.id, { shiftDate: plus(0), startTime: "10:00", endTime: "14:00" });
    expect(edited.startTime.slice(0, 5)).toBe("10:00");
    await r.scheduling.deleteShift(ctx.businessId, made.id);
    expect(await r.scheduling.listShifts(ctx.businessId, { from: plus(0), to: plus(0) })).toHaveLength(0);
  });

  it("copies a week and skips shifts that would overlap", async () => {
    const from = await r.scheduling.createShift(ctx.businessId, shift(plus(0), "09:00", "12:00")); // Monday
    await r.scheduling.createShift(ctx.businessId, shift(plus(1), "09:00", "12:00"));
    await r.scheduling.createShift(ctx.businessId, shift(plus(8), "10:00", "11:00")); // blocks the copy of the Tuesday shift
    const result = await r.scheduling.copyWeek(ctx.businessId, { fromWeekStart: plus(0), toWeekStart: plus(7) });
    expect(result).toEqual({ created: 1, skipped: 1 });
    expect(from.shiftDate).toBe(plus(0));
  });
});
