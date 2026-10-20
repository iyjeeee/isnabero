import { pgTable, uuid, integer, numeric, pgEnum, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { businesses, employees, paymentRecords } from "./core";
import { offerings } from "./catalog";

// pos_order_status: lifecycle of a single sale
export const posOrderStatusEnum = pgEnum("pos_order_status", ["open", "paid", "voided"]);

// pos_orders: one row per checkout — links to payment_records once settled
export const posOrders = pgTable(
  "pos_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "set null" }), // who rang up the sale
    status: posOrderStatusEnum("status").notNull().default("open"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
    paymentRecordId: uuid("payment_record_id").references(() => paymentRecords.id, { onDelete: "set null" }),
    receiptNumber: integer("receipt_number").notNull(), // sequential per business, assigned by a DB trigger (mock: next number)
    clientId: uuid("client_id"), // made by the app for each sale so an offline sale sent twice is recorded once (migration 0014)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("pos_orders_receipt_unique").on(table.businessId, table.receiptNumber),
    uniqueIndex("pos_orders_client_unique").on(table.businessId, table.clientId).where(sql`${table.clientId} is not null`),
  ],
);

// pos_order_items: line items per order, snapshotting price at time of sale so later price edits don't rewrite history
export const posOrderItems = pgTable("pos_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => posOrders.id, { onDelete: "cascade" }),
  offeringId: uuid("offering_id")
    .notNull()
    .references(() => offerings.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(), // snapshot of offerings.price at sale time
});
