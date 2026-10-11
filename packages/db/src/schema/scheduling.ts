import { pgTable, uuid, text, date, time, timestamp } from "drizzle-orm/pg-core";
import { businesses, employees } from "./core";

// shifts: one planned work block for one employee on one calendar day. Wall-clock times (no timezone) on purpose —
// "9:00–17:00 on Monday" means the same thing wherever the business is. Same-day only (end after start); the database also
// refuses overlapping shifts for the same employee (see migration 0008).
export const shifts = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }), // removing an employee removes their shifts
  shiftDate: date("shift_date", { mode: "string" }).notNull(), // YYYY-MM-DD
  startTime: time("start_time").notNull(), // HH:MM(:SS)
  endTime: time("end_time").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
