import { describe, expect, it } from "vitest";
import type { Expense } from "@isnabero/module-expenses";
import type { BookingWithOffering } from "@isnabero/module-booking";
import type { OfferingWithInclusions } from "@isnabero/module-catalog";
import { bookingRows, employeeRows, expenseRows, offeringRows, paymentRows, salesReportRows } from "../export-rows";

const expense = (overrides: Partial<Expense>): Expense => ({
  id: "1", businessId: "b", category: "rent", description: "Rent", amount: 100, expenseDate: "2026-03-10",
  method: "cash", notes: null, recordedBy: null, voidedAt: null, createdAt: new Date(), ...overrides,
});

describe("export rows", () => {
  it("expenses: labels, status and inclusive date filtering", () => {
    const rows = expenseRows(
      [expense({}), expense({ id: "2", expenseDate: "2026-03-09", voidedAt: new Date(), notes: "late" }), expense({ id: "3", expenseDate: "2026-04-01" })],
      { from: "2026-03-09", to: "2026-03-10" },
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ Date: "2026-03-10", Category: "Rent", Description: "Rent", Method: "cash", Amount: 100, Notes: "", Status: "Active" });
    expect(rows[1]).toMatchObject({ Status: "Voided", Notes: "late" });
  });

  it("payments: local date/time columns, blank reference, range applied", () => {
    const at = new Date(2026, 2, 10, 9, 5);
    const rows = paymentRows(
      [
        { id: "1", sourceModule: "pos", method: "gcash", referenceCode: null, amount: 50, createdAt: at, voidedAt: null },
        { id: "2", sourceModule: "pos", method: "cash", referenceCode: "R1", amount: 5, createdAt: new Date(2026, 2, 12), voidedAt: null },
      ],
      { to: "2026-03-10" },
    );
    expect(rows).toEqual([{ Date: "2026-03-10", Time: "09:05", Source: "pos", Method: "gcash", Reference: "", Amount: 50, Status: "Active" }]);
  });

  it("bookings: joins the offering name and filters by start day", () => {
    const booking = {
      startTime: new Date(2026, 2, 10, 14, 0), endTime: new Date(2026, 2, 10, 14, 30), customerName: "Ana", customerContact: null,
      mode: "appointment", status: "pending", offering: { name: "Bundle A" },
    } as unknown as BookingWithOffering;
    expect(bookingRows([booking], { from: "2026-03-11" })).toEqual([]);
    expect(bookingRows([booking], {})[0]).toEqual({
      Date: "2026-03-10", Start: "14:00", End: "14:30", Customer: "Ana", Contact: "", Offering: "Bundle A", Mode: "appointment", Status: "pending",
    });
  });

  it("offerings: numeric price, blank duration, readable inclusions", () => {
    const offering = {
      name: "Bundle A", type: "bundle", price: "499.00", durationMinutes: null, isAvailable: false, description: null,
      inclusions: [{ label: "Prints", quantity: 2 }, { label: "Unli shots", quantity: null }],
    } as unknown as OfferingWithInclusions;
    expect(offeringRows([offering])[0]).toEqual({
      Name: "Bundle A", Type: "bundle", Price: 499, "Duration (min)": "", Available: "No", Description: "", Inclusions: "Prints (2); Unli shots",
    });
  });

  it("employees and sales report map straight across", () => {
    expect(employeeRows([{ id: "1", fullName: "Juan", role: "owner", createdAt: new Date(2026, 0, 5) }])).toEqual([{ Name: "Juan", Role: "owner", Added: "2026-01-05" }]);
    expect(salesReportRows([{ date: "2026-03-10", value: 12.5 }])).toEqual([{ Date: "2026-03-10", Revenue: 12.5 }]);
  });
});
