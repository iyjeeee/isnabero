import { describe, it, expect } from "vitest";
import { mockBookingRepository } from "../mock-repository";
import { mockDb, DEMO_BUSINESS_ID, auditRows } from "@isnabero/db";
import { BookingConflictError } from "../overlap";
import { BOOKING_NOT_EDITABLE_MESSAGE, BookingStatusError, canTransition, isEditable, nextStatuses } from "../status";

const offeringId = () => mockDb.offerings.find((offering) => offering.businessId === DEMO_BUSINESS_ID && offering.durationMinutes)!.id;

// book: a pending booking on a fixed far-future day, `hour` UTC for 10 minutes
async function book(day: string, hour: number, customerName = "Status Test") {
  const startTime = new Date(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);
  return mockBookingRepository.createBooking(DEMO_BUSINESS_ID, {
    offeringId: offeringId(),
    mode: "appointment",
    customerName,
    customerContact: null,
    startTime,
    endTime: new Date(startTime.getTime() + 10 * 60000),
    paymentRecordId: null,
  });
}

describe("booking status rules", () => {
  it("allows pending -> confirmed -> completed and cancelling an open booking, nothing else", () => {
    expect(nextStatuses("pending")).toEqual(["confirmed", "cancelled"]);
    expect(nextStatuses("confirmed")).toEqual(["completed", "cancelled"]);
    expect(nextStatuses("completed")).toEqual([]);
    expect(nextStatuses("cancelled")).toEqual([]);
    expect(canTransition("pending", "completed")).toBe(false);
    expect(canTransition("cancelled", "pending")).toBe(false);
    expect(canTransition("unknown", "confirmed")).toBe(false);
  });

  it("only open bookings are editable", () => {
    expect(["pending", "confirmed"].every(isEditable)).toBe(true);
    expect(["completed", "cancelled"].some(isEditable)).toBe(false);
  });
});

describe("mockBookingRepository.updateBookingStatus", () => {
  it("moves a booking through its lifecycle and logs each change", async () => {
    const booking = await book("2032-01-10", 9, "Lifecycle Lee");
    expect((await mockBookingRepository.updateBookingStatus(DEMO_BUSINESS_ID, booking.id, "confirmed")).status).toBe("confirmed");
    expect((await mockBookingRepository.updateBookingStatus(DEMO_BUSINESS_ID, booking.id, "completed")).status).toBe("completed");
    const entries = auditRows.filter((row) => row.entityId === booking.id && row.action === "booking.status_changed");
    expect(entries.map((row) => row.summary)).toEqual([
      `Booking for Lifecycle Lee (${booking.offering.name}): pending → confirmed`,
      `Booking for Lifecycle Lee (${booking.offering.name}): confirmed → completed`,
    ]);
  });

  it("refuses an impossible change, including reviving a cancelled booking", async () => {
    const booking = await book("2032-01-11", 9);
    await expect(mockBookingRepository.updateBookingStatus(DEMO_BUSINESS_ID, booking.id, "completed")).rejects.toThrow(BookingStatusError);
    await mockBookingRepository.updateBookingStatus(DEMO_BUSINESS_ID, booking.id, "cancelled");
    await expect(mockBookingRepository.updateBookingStatus(DEMO_BUSINESS_ID, booking.id, "pending")).rejects.toThrow("A cancelled booking can't be changed to pending.");
  });

  it("frees the slot when cancelled", async () => {
    const booking = await book("2032-01-12", 9);
    await expect(book("2032-01-12", 9, "Second")).rejects.toThrow(BookingConflictError);
    await mockBookingRepository.updateBookingStatus(DEMO_BUSINESS_ID, booking.id, "cancelled");
    await expect(book("2032-01-12", 9, "Second")).resolves.toMatchObject({ customerName: "Second" });
  });

  it("won't touch another business's booking", async () => {
    const booking = await book("2032-01-13", 9);
    await expect(mockBookingRepository.updateBookingStatus("some-other-business", booking.id, "confirmed")).rejects.toThrow("Booking not found");
  });
});

describe("mockBookingRepository.updateBooking", () => {
  it("edits the details and logs it", async () => {
    const booking = await book("2032-02-01", 9, "Before");
    const updated = await mockBookingRepository.updateBooking(DEMO_BUSINESS_ID, booking.id, {
      offeringId: booking.offeringId,
      customerName: "After",
      customerContact: "0917 000 0000",
      startTime: new Date("2032-02-01T11:00:00Z"),
      endTime: new Date("2032-02-01T11:10:00Z"),
    });
    expect(updated).toMatchObject({ customerName: "After", customerContact: "0917 000 0000" });
    expect(updated.startTime.toISOString()).toBe("2032-02-01T11:00:00.000Z");
    expect(auditRows.find((row) => row.entityId === booking.id && row.action === "booking.updated")?.summary).toBe(`Updated booking for After (${booking.offering.name})`);
  });

  it("can keep its own slot but not take someone else's", async () => {
    const first = await book("2032-02-02", 9, "First");
    const second = await book("2032-02-02", 10, "Second");
    const input = (start: string, end: string) => ({ offeringId: first.offeringId, customerName: "First", customerContact: null, startTime: new Date(start), endTime: new Date(end) });
    await expect(mockBookingRepository.updateBooking(DEMO_BUSINESS_ID, first.id, input("2032-02-02T09:05:00Z", "2032-02-02T09:15:00Z"))).resolves.toBeTruthy();
    await expect(mockBookingRepository.updateBooking(DEMO_BUSINESS_ID, first.id, input("2032-02-02T10:05:00Z", "2032-02-02T10:15:00Z"))).rejects.toThrow(BookingConflictError);
    expect(second.status).toBe("pending");
  });

  it("refuses to edit a finished booking or an invalid time range", async () => {
    const booking = await book("2032-02-03", 9);
    const input = { offeringId: booking.offeringId, customerName: "X", customerContact: null, startTime: new Date("2032-02-03T09:00:00Z"), endTime: new Date("2032-02-03T08:00:00Z") };
    await expect(mockBookingRepository.updateBooking(DEMO_BUSINESS_ID, booking.id, input)).rejects.toThrow("end time must be after");
    await mockBookingRepository.updateBookingStatus(DEMO_BUSINESS_ID, booking.id, "cancelled");
    await expect(mockBookingRepository.updateBooking(DEMO_BUSINESS_ID, booking.id, { ...input, endTime: new Date("2032-02-03T09:10:00Z") })).rejects.toThrow(BOOKING_NOT_EDITABLE_MESSAGE);
  });
});
