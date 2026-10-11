import type { BookingWithOffering } from "@isnabero/module-booking";
import type { OfferingWithInclusions } from "@isnabero/module-catalog";
import { getAuditActionLabel } from "@isnabero/db";
import type { StockLevel, StockMovementView } from "@isnabero/module-inventory";
import { getExpenseCategoryLabel, type Expense } from "@isnabero/module-expenses";
import { formatHours, shiftMinutes, type Shift } from "@isnabero/module-scheduling";
import { inDateRange, toLocalYmd, type DateRange } from "@/lib/date-range";
import type { AuditLogEntry, EmployeeView, PaymentRecordView } from "@/lib/repositories/repository";

export type CsvRow = Record<string, string | number>;

const localTime = (date: Date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

// Row builders: one per export, kept pure so the CSV columns are unit-tested. Dates are local calendar days and
// times local HH:mm (not UTC ISO strings) so a spreadsheet shows what the user saw in the app.

export function paymentRows(records: PaymentRecordView[], range: DateRange): CsvRow[] {
  return records
    .filter((record) => inDateRange(toLocalYmd(record.createdAt), range))
    .map((record) => ({
      Date: toLocalYmd(record.createdAt),
      Time: localTime(record.createdAt),
      Source: record.sourceModule,
      Method: record.method,
      Reference: record.referenceCode ?? "",
      Amount: record.amount,
      Status: record.voidedAt ? "Voided" : "Active",
    }));
}

export function expenseRows(expenses: Expense[], range: DateRange): CsvRow[] {
  return expenses
    .filter((expense) => inDateRange(expense.expenseDate, range))
    .map((expense) => ({
      Date: expense.expenseDate,
      Category: getExpenseCategoryLabel(expense.category),
      Description: expense.description,
      Method: expense.method,
      Amount: expense.amount,
      Notes: expense.notes ?? "",
      Status: expense.voidedAt ? "Voided" : "Active",
    }));
}

export function bookingRows(bookings: BookingWithOffering[], range: DateRange): CsvRow[] {
  return bookings
    .filter((booking) => inDateRange(toLocalYmd(new Date(booking.startTime)), range))
    .map((booking) => {
      const start = new Date(booking.startTime);
      return {
        Date: toLocalYmd(start),
        Start: localTime(start),
        End: localTime(new Date(booking.endTime)),
        Customer: booking.customerName,
        Contact: booking.customerContact ?? "",
        Offering: booking.offering.name,
        Mode: booking.mode,
        Status: booking.status,
      };
    });
}

export function offeringRows(offerings: OfferingWithInclusions[]): CsvRow[] {
  return offerings.map((offering) => ({
    Name: offering.name,
    Type: offering.type,
    Price: Number(offering.price),
    "Duration (min)": offering.durationMinutes ?? "",
    Available: offering.isAvailable ? "Yes" : "No",
    Description: offering.description ?? "",
    Inclusions: offering.inclusions.map((inclusion) => (inclusion.quantity ? `${inclusion.label} (${inclusion.quantity})` : inclusion.label)).join("; "),
  }));
}

export function employeeRows(employees: EmployeeView[]): CsvRow[] {
  return employees.map((employee) => ({ Name: employee.fullName, Role: employee.role, Added: toLocalYmd(employee.createdAt) }));
}

export function auditLogRows(entries: AuditLogEntry[], range: DateRange): CsvRow[] {
  return entries
    .filter((entry) => inDateRange(toLocalYmd(entry.createdAt), range))
    .map((entry) => ({
      Date: toLocalYmd(entry.createdAt),
      Time: localTime(entry.createdAt),
      Who: entry.actorName,
      Action: getAuditActionLabel(entry.action),
      Details: entry.summary,
    }));
}

const WEEKDAY = new Intl.DateTimeFormat("en-PH", { weekday: "short" });

// shiftRows: one row per shift in the date range; `employeeNames` maps employee id -> name
export function shiftRows(shifts: Shift[], employeeNames: Map<string, string>, range: DateRange): CsvRow[] {
  return shifts
    .filter((shift) => inDateRange(shift.shiftDate, range))
    .map((shift) => ({
      Date: shift.shiftDate,
      Day: WEEKDAY.format(new Date(`${shift.shiftDate}T00:00:00`)),
      Employee: employeeNames.get(shift.employeeId) ?? "Unknown employee",
      Start: shift.startTime,
      End: shift.endTime,
      Hours: formatHours(shiftMinutes(shift)),
      Note: shift.note ?? "",
    }));
}

export function stockRows(levels: StockLevel[]): CsvRow[] {
  return levels.map((level) => ({
    Item: level.offeringName,
    Type: level.offeringType,
    "In stock": level.quantity,
    "Low-stock level": level.lowStockThreshold,
    Status: level.status === "out" ? "Out of stock" : level.status === "low" ? "Low" : "OK",
  }));
}

export function stockMovementRows(movements: StockMovementView[], range: DateRange): CsvRow[] {
  return movements
    .filter((movement) => inDateRange(toLocalYmd(movement.createdAt), range))
    .map((movement) => ({
      Date: toLocalYmd(movement.createdAt),
      Time: localTime(movement.createdAt),
      Item: movement.offeringName,
      Change: movement.delta,
      Type: movement.kind,
      Reason: movement.note ?? "",
      By: movement.recordedByName ?? "System",
    }));
}

export function salesReportRows(daily: { date: string; value: number }[]): CsvRow[] {
  return daily.map((point) => ({ Date: point.date, Revenue: point.value }));
}
