import { pgTable, uuid, text, timestamp, boolean, numeric, pgEnum, unique } from "drizzle-orm/pg-core";

// employee_role: permission level within a business, used across every module for access control
export const employeeRoleEnum = pgEnum("employee_role", ["owner", "admin", "staff"]);

// module_key: the catalog of every add/remove module the sidebar can toggle — extend this list as new modules ship
export const moduleKeyEnum = pgEnum("module_key", [
  "catalog",
  "pos",
  "booking",
  "online_store",
  "inventory",
  "expenses",
]);

// payment_method: how a transaction was settled — kept generic since reference-code flows are all "manual" methods
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "gcash", "bank_transfer", "other"]);

// businesses: one row per tenant — every other table references business_id for RLS-based isolation
export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // used for tenant lookup / future public storefront URLs
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// business_modules: which sidebar modules are enabled per business — this table drives the dynamic sidebar
export const businessModules = pgTable(
  "business_modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    moduleKey: moduleKeyEnum("module_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("business_module_unique").on(table.businessId, table.moduleKey)],
);

// employees: staff accounts scoped to a business — userId links to Supabase auth.users
export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(), // references auth.users(id) in Supabase, kept loose here since that table lives outside Drizzle's schema
  fullName: text("full_name").notNull(),
  role: employeeRoleEnum("role").notNull().default("staff"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// payment_records: single ledger for every transaction regardless of which module produced it
export const paymentRecords = pgTable("payment_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  sourceModule: moduleKeyEnum("source_module").notNull(), // which module created this record (pos, booking, online_store)
  method: paymentMethodEnum("method").notNull(),
  referenceCode: text("reference_code"), // e.g. GCash ref number — null for plain cash
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // voidedAt: soft-delete instead of hard delete — a payment record is financial history, so "deleting"
  // a mistaken/duplicate entry marks it voided (excluded from totals/default view) rather than erasing
  // it outright. Null = active record.
  voidedAt: timestamp("voided_at", { withTimezone: true }),
});
