import { describe, it, expect } from "vitest";
import { mockBookingRepository } from "../mock-repository";
import { mockDb, DEMO_BUSINESS_ID } from "@isnabero/db";

function getSeededBundleOfferingId(): string {
  const bundle = mockDb.offerings.find((offering) => offering.businessId === DEMO_BUSINESS_ID && offering.durationMinutes);
  if (!bundle) throw new Error("Expected a seeded bookable offering (with durationMinutes) to exist");
  return bundle.id;
}

describe("mockBookingRepository", () => {
  it("creates a booking joined with its offering", async () => {
    const offeringId = getSeededBundleOfferingId();
    const start = new Date("2026-09-01T10:00:00Z");
    const end = new Date("2026-09-01T10:10:00Z");

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
      startTime: new Date("2026-10-05T09:00:00Z"),
      endTime: new Date("2026-10-05T09:10:00Z"),
      paymentRecordId: null,
    });
    await mockBookingRepository.createBooking(DEMO_BUSINESS_ID, {
      offeringId,
      mode: "appointment",
      customerName: "Out Of Range",
      customerContact: null,
      startTime: new Date("2026-11-20T09:00:00Z"),
      endTime: new Date("2026-11-20T09:10:00Z"),
      paymentRecordId: null,
    });

    const results = await mockBookingRepository.listBookings(DEMO_BUSINESS_ID, "2026-10-01T00:00:00Z", "2026-10-31T23:59:59Z");
    expect(results.some((booking) => booking.customerName === "In Range")).toBe(true);
    expect(results.some((booking) => booking.customerName === "Out Of Range")).toBe(false);
  });
});
