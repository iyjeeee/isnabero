import { describe, expect, it } from "vitest";
import type { Expense } from "@isnabero/module-expenses";
import type { BookingWithOffering } from "@isnabero/module-booking";
import type { OfferingWithInclusions } from "@isnabero/module-catalog";
import { bookingRows, employeeRows, expenseRows, offeringRows, paymentRows, salesReportRows, shiftRows, stockMovementRows, stockRows } from "../export-rows";

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

  it("stock levels and movements: readable status, signed change, System when no one acted", () => {
    expect(stockRows([{ offeringId: "1", offeringName: "Sisig", offeringType: "item", quantity: 2, lowStockThreshold: 5, status: "low" }])).toEqual([
      { Item: "Sisig", Type: "item", "In stock": 2, "Low-stock level": 5, Status: "Low" },
    ]);
    const movement = { id: "1", offeringId: "1", offeringName: "Sisig", delta: -2, kind: "sale" as const, note: null, recordedByName: null, createdAt: new Date(2026, 2, 10, 9, 5) };
    expect(stockMovementRows([movement], { from: "2026-03-11" })).toEqual([]);
    expect(stockMovementRows([movement], {})).toEqual([{ Date: "2026-03-10", Time: "09:05", Item: "Sisig", Change: -2, Type: "sale", Reason: "", By: "System" }]);
  });

  it("shifts: weekday, hours, employee name (or Unknown), and the date range filter", () => {
    const shift = { id: "1", businessId: "b", employeeId: "e1", shiftDate: "2026-10-05", startTime: "09:00", endTime: "17:30", note: "Opens" };
    const names = new Map([["e1", "Pedro Reyes"]]);
    expect(shiftRows([shift], names, {})).toEqual([{ Date: "2026-10-05", Day: "Mon", Employee: "Pedro Reyes", Start: "09:00", End: "17:30", Hours: "8h 30m", Note: "Opens" }]);
    expect(shiftRows([{ ...shift, employeeId: "gone", note: null }], names, {})[0]).toMatchObject({ Employee: "Unknown employee", Note: "" });
    expect(shiftRows([shift], names, { from: "2026-10-06" })).toEqual([]);
  });
});
