import type { bookings } from "@isnabero/db";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { OfferingWithInclusions } from "@isnabero/module-catalog";

export type Booking = InferSelectModel<typeof bookings>;
export type NewBooking = InferInsertModel<typeof bookings>;

// BookingWithOffering: a booking joined with the offering/package it's for — the shape the calendar UI renders
export type BookingWithOffering = Booking & { offering: OfferingWithInclusions };
