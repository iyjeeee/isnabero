import { describe, expect, it } from "vitest";
import type { BookingWithOffering } from "@isnabero/module-booking";
import { customerKey, groupCustomers } from "../customers";

const make = (id: string, name: string, contact: string | null, start: string, status: BookingWithOffering["status"] = "completed", price = "500.00"): BookingWithOffering =>
  ({ id, customerName: name, customerContact: contact, startTime: new Date(start), endTime: new Date(start), status, offering: { id: "o", name: "Package", price } }) as unknown as BookingWithOffering;

describe("customerKey", () => {
  it("matches contacts however they are spaced and names however they are cased", () => {
    expect(customerKey("A", "0917 123 4567")).toBe(customerKey("B", "09171234567"));
    expect(customerKey("  Ana   Cruz ", null)).toBe(customerKey("ana cruz", ""));
  });
});

describe("groupCustomers", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const customers = groupCustomers(
    [
      make("1", "Ana Cruz", "0917 123 4567", "2026-05-01T10:00:00Z"),
      make("2", "Ana C.", "09171234567", "2026-06-01T10:00:00Z", "completed", "700.00"),
      make("3", "Ana Cruz", "09171234567", "2026-06-10T10:00:00Z", "cancelled"),
      make("4", "Ana Cruz", "09171234567", "2026-06-20T10:00:00Z", "confirmed"),
      make("5", "Ben", null, "2026-04-01T10:00:00Z"),
    ],
    now,
  );

  it("merges one person's bookings and totals the completed ones", () => {
    const ana = customers.find((customer) => customer.bookings.length === 4)!;
    expect(ana.visits).toBe(2);
    expect(ana.cancelled).toBe(1);
    expect(ana.spent).toBe(1200);
    expect(ana.lastVisit).toEqual(new Date("2026-06-01T10:00:00Z"));
    expect(ana.next).toEqual(new Date("2026-06-20T10:00:00Z"));
    expect(ana.name).toBe("Ana Cruz"); // the latest booking's spelling
  });

  it("lists the most recently active customer first", () => {
    expect(customers.map((customer) => customer.name)).toEqual(["Ana Cruz", "Ben"]);
  });
});
