import { describe, expect, it } from "vitest";
import { bookingMinutes, toDateTimeLocal } from "../booking-form";

describe("booking form helpers", () => {
  it("formats a date for datetime-local in local time", () => {
    expect(toDateTimeLocal(new Date(2031, 8, 1, 9, 5))).toBe("2031-09-01T09:05");
    expect(toDateTimeLocal(new Date(2031, 11, 31, 23, 59))).toBe("2031-12-31T23:59");
  });

  it("uses the package duration for new bookings, or an hour when it has none", () => {
    expect(bookingMinutes({ offeringDuration: 20 })).toBe(20);
    expect(bookingMinutes({ offeringDuration: null })).toBe(60);
  });

  it("keeps an edited booking's length unless the package changed", () => {
    const existing = { startTime: new Date(2031, 8, 1, 9, 0), endTime: new Date(2031, 8, 1, 9, 45) };
    expect(bookingMinutes({ offeringDuration: 10, existing: { ...existing, offeringChanged: false } })).toBe(45);
    expect(bookingMinutes({ offeringDuration: 10, existing: { ...existing, offeringChanged: true } })).toBe(10);
  });
});
