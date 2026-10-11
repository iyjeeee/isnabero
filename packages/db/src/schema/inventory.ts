import { pgTable, pgEnum, uuid, text, integer, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { businesses, employees } from "./core";
import { offerings } from "./catalog";

// stock_movement_kind: why the count changed. "sale" rows are written by checkout; the rest are manual adjustments.
export const stockMovementKindEnum = pgEnum("stock_movement_kind", ["initial", "restock", "correction", "damage", "return", "sale"]);

// stock_items: an offering is "tracked" exactly when it has a row here (services and bundles simply have none).
// `quantity` is derived from stock_movements by a database trigger — never written directly by the app.
export const stockItems = pgTable(
  "stock_items",
  {
    offeringId: uuid("offering_id")
      .primaryKey()
      .references(() => offerings.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(0), // at or below this = "low stock" warning
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("stock_items_quantity_non_negative", sql`${table.quantity} >= 0`), // the database itself refuses to oversell
    check("stock_items_threshold_non_negative", sql`${table.lowStockThreshold} >= 0`),
  ],
);

// stock_movements: append-only ledger (like audit_log) — every change to a count, with who and why.
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    offeringId: uuid("offering_id")
      .notNull()
      .references(() => offerings.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(), // +restock / -sale
    kind: stockMovementKindEnum("kind").notNull(),
    note: text("note"), // required for manual adjustments (enforced in the app)
    referenceId: uuid("reference_id"), // e.g. the POS order for a "sale"
    recordedBy: uuid("recorded_by").references(() => employees.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("stock_movements_delta_non_zero", sql`${table.delta} <> 0`)],
);
