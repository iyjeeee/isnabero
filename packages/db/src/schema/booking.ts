import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { businesses, paymentRecords } from "./core";
import { offerings } from "./catalog";

// booking_status: lifecycle of a single appointment/reservation
export const bookingStatusEnum = pgEnum("booking_status", ["pending", "confirmed", "completed", "cancelled"]);

// booking_mode: how the customer receives the service — kept generic across studio bookings, pickup orders, etc.
export const bookingModeEnum = pgEnum("booking_mode", ["appointment", "pickup", "delivery"]);

// bookings: one row per reserved slot — offeringId must reference an offering with durationMinutes set
export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  offeringId: uuid("offering_id")
    .notNull()
    .references(() => offerings.id, { onDelete: "restrict" }),
  mode: bookingModeEnum("mode").notNull().default("appointment"),
  customerName: text("customer_name").notNull(),
  customerContact: text("customer_contact"), // phone/email/social handle, kept free-text
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  status: bookingStatusEnum("status").notNull().default("pending"),
  paymentRecordId: uuid("payment_record_id").references(() => paymentRecords.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
