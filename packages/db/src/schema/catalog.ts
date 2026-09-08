import { pgTable, uuid, text, integer, boolean, numeric, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { businesses } from "./core";

// offering_type: simple item, a bundle with inclusions, or an add-on attached to another offering
export const offeringTypeEnum = pgEnum("offering_type", ["item", "bundle", "addon"]);

// offerings: anything a customer can pick — a menu item, a photobooth package, a product — shared by POS & Booking
export const offerings = pgTable("offerings", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: offeringTypeEnum("type").notNull().default("item"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  durationMinutes: integer("duration_minutes"), // set when this offering consumes a booking time slot
  isAvailable: boolean("is_available").notNull().default(true), // manual sold-out / hidden toggle — stands in for full inventory
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// offering_inclusions: what's covered by a bundle, e.g. "10 mins unli shots", "2 prints"
export const offeringInclusions = pgTable("offering_inclusions", {
  id: uuid("id").primaryKey().defaultRandom(),
  offeringId: uuid("offering_id")
    .notNull()
    .references(() => offerings.id, { onDelete: "cascade" }),
  label: text("label").notNull(), // e.g. "Unli shots", "Printed copies"
  quantity: integer("quantity"), // null = unlimited/not applicable, e.g. "unli" inclusions
});
