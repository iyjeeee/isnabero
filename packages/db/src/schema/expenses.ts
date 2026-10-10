import { pgTable, uuid, text, numeric, date, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { businesses, employees, paymentMethodEnum } from "./core";

// expense_category: fixed list for v1 — extend here (and EXPENSE_CATEGORIES in packages/modules/expenses) to add one
export const expenseCategoryEnum = pgEnum("expense_category", ["rent", "utilities", "supplies", "salaries", "other"]);

// expenses: money the business spent. Like payment_records it's financial history — never hard-deleted, only voided.
export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  category: expenseCategoryEnum("category").notNull(),
  description: text("description").notNull(), // short label, e.g. "Electricity bill"
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  expenseDate: date("expense_date", { mode: "string" }).notNull(), // calendar day it was paid (YYYY-MM-DD), not a timestamp
  method: paymentMethodEnum("method").notNull().default("cash"),
  notes: text("notes"),
  recordedBy: uuid("recorded_by").references(() => employees.id, { onDelete: "set null" }), // who entered it
  voidedAt: timestamp("voided_at", { withTimezone: true }), // null = active; set = voided (excluded from totals)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
