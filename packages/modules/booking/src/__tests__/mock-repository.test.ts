import { describe, it, expect } from "vitest";
import { mockBookingRepository } from "../mock-repository";
import { mockDb, DEMO_BUSINESS_ID, auditRows } from "@isnabero/db";
import { BookingConflictError } from "../overlap";

function getSeededBundleOfferingId(): string {
  const bundle = mockDb.offerings.find((offering) => offering.businessId === DEMO_BUSINESS_ID && offering.durationMinutes);
  if (!bundle) throw new Error("Expected a seeded bookable offering (with durationMinutes) to exist");
  return bundle.id;
}

describe("mockBookingRepository", () => {
  it("creates a booking joined with its offering", async () => {
    const offeringId = getSeededBundleOfferingId();
    const start = new Date("2031-09-01T10:00:00Z");
    const end = new Date("2031-09-01T10:10:00Z");

    const booking = await mockBookingRepository.createBooking(DEMO_BUSINESS_ID, {
      offeringId,
      mode: "appointment",
      customerName: "Test Customer",
      customerContact: null,
      startTime: start,
      endTime: end,
      paymentRecordId: null,
    });

    expect(booking.customerName).toBe("Test Customer");
    expect(booking.status).toBe("pending");
    expect(booking.offering.id).toBe(offeringId);
  });

  it("lists bookings only within the given date range", async () => {
    const offeringId = getSeededBundleOfferingId();
    await mockBookingRepository.createBooking(DEMO_BUSINESS_ID, {
      offeringId,
      mode: "appointment",
      customerName: "In Range",
      customerContact: null,
      startTime: new Date("2031-10-05T09:00:00Z"),
      endTime: new Date("2031-10-05T09:10:00Z"),
      paymentRecordId: null,
    });
    await mockBookingRepository.createBooking(DEMO_BUSINESS_ID, {
      offeringId,
      mode: "appointment",
      customerName: "Out Of Range",
      customerContact: null,
      startTime: new Date("2031-11-20T09:00:00Z"),
      endTime: new Date("2031-11-20T09:10:00Z"),
      paymentRecordId: null,
    });

    const results = await mockBookingRepository.listBookings(DEMO_BUSINESS_ID, "2031-10-01T00:00:00Z", "2031-10-31T23:59:59Z");
    expect(results.some((booking) => booking.customerName === "In Range")).toBe(true);
    expect(results.some((booking) => booking.customerName === "Out Of Range")).toBe(false);
  });

  // Overlap rule: far-future 2032 dates keep these isolated from seeded data and from the tests above
  describe("overlap rule", () => {
    const book = (customerName: string, start: string, end: string) =>
      mockBookingRepository.createBooking(DEMO_BUSINESS_ID, {
        offeringId: getSeededBundleOfferingId(),
        mode: "appointment",
        customerName,
        customerContact: null,
        startTime: new Date(start),
        endTime: new Date(end),
        paymentRecordId: null,
      });

    it("rejects a booking that overlaps an existing one, naming the clash", async () => {
      await book("First", "2032-03-01T10:00:00Z", "2032-03-01T11:00:00Z");
      await expect(book("Second", "2032-03-01T10:30:00Z", "2032-03-01T11:30:00Z")).rejects.toBeInstanceOf(BookingConflictError);
      await expect(book("Third", "2032-03-01T09:30:00Z", "2032-03-01T10:15:00Z")).rejects.toThrow(/First/);
      await expect(book("Inside", "2032-03-01T10:15:00Z", "2032-03-01T10:45:00Z")).rejects.toBeInstanceOf(BookingConflictError);
    });

    it("allows back-to-back bookings (end == next start)", async () => {
      await book("Early", "2032-04-01T10:00:00Z", "2032-04-01T11:00:00Z");
      await expect(book("Right After", "2032-04-01T11:00:00Z", "2032-04-01T12:00:00Z")).resolves.toBeTruthy();
      await expect(book("Right Before", "2032-04-01T09:00:00Z", "2032-04-01T10:00:00Z")).resolves.toBeTruthy();
    });

    it("frees the slot when the existing booking is cancelled", async () => {
      const existing = await book("Will Cancel", "2032-05-01T10:00:00Z", "2032-05-01T11:00:00Z");
      const row = mockDb.bookings.find((item) => item.id === existing.id)!;
      row.status = "cancelled";
      await expect(book("Takes Slot", "2032-05-01T10:00:00Z", "2032-05-01T11:00:00Z")).resolves.toBeTruthy();
    });

    it("rejects a booking whose end is not after its start", async () => {
      await expect(book("Bad Range", "2032-06-01T11:00:00Z", "2032-06-01T10:00:00Z")).rejects.toThrow(/end time/);
    });
  });
});

describe("booking audit trail", () => {
  it("logs a created booking but not one rejected for overlapping", async () => {
    const offeringId = getSeededBundleOfferingId();
    const input = { offeringId, mode: "appointment" as const, customerName: "Audit Customer", customerContact: null, paymentRecordId: null };
    const booking = await mockBookingRepository.createBooking(DEMO_BUSINESS_ID, { ...input, startTime: new Date("2033-05-01T10:00:00Z"), endTime: new Date("2033-05-01T10:10:00Z") });
    const before = auditRows.length;
    await expect(
      mockBookingRepository.createBooking(DEMO_BUSINESS_ID, { ...input, startTime: new Date("2033-05-01T10:05:00Z"), endTime: new Date("2033-05-01T10:15:00Z") }),
    ).rejects.toThrow();
    expect(auditRows.length).toBe(before);
    expect(auditRows.find((row) => row.entityId === booking.id)).toMatchObject({ action: "booking.created", summary: expect.stringContaining("for Audit Customer") });
  });
});
