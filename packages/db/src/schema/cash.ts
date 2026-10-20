import { pgTable, uuid, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { businesses, employees } from "./core";

// cash_closes: an end-of-shift cash count. Written only by the close_cash() database function (migration 0015), never by the app directly.
export const cashCloses = pgTable("cash_closes", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(), // the previous close's end (or the start of the first day)
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  openingFloat: numeric("opening_float", { precision: 12, scale: 2 }).notNull(), // cash already in the drawer at the start
  cashSales: numeric("cash_sales", { precision: 12, scale: 2 }).notNull(),
  cashExpenses: numeric("cash_expenses", { precision: 12, scale: 2 }).notNull(),
  expected: numeric("expected", { precision: 12, scale: 2 }).notNull(), // float + cash sales - cash expenses
  counted: numeric("counted", { precision: 12, scale: 2 }).notNull(),
  difference: numeric("difference", { precision: 12, scale: 2 }).notNull(), // counted - expected (negative = short)
  note: text("note"),
  closedBy: uuid("closed_by").references(() => employees.id, { onDelete: "set null" }),
  closedByName: text("closed_by_name").notNull().default("System"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
