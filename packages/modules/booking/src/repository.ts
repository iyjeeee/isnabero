import type { BookingWithOffering, NewBooking } from "./types";
import type { BookingStatus } from "./status";

export type CreateBookingInput = Omit<NewBooking, "businessId" | "id" | "createdAt" | "status">;
// UpdateBookingInput: the editable details of an open booking (the status has its own method)
export type UpdateBookingInput = Pick<CreateBookingInput, "offeringId" | "customerName" | "customerContact" | "startTime" | "endTime">;

// BookingRepository: data-access contract for the Booking module.
export interface BookingRepository {
  listBookings(businessId: string, from: string, to: string): Promise<BookingWithOffering[]>;
  createBooking(businessId: string, input: CreateBookingInput): Promise<BookingWithOffering>;
  // updateBooking: only pending/confirmed bookings; re-checks the time slot (excluding this booking itself)
  updateBooking(businessId: string, bookingId: string, input: UpdateBookingInput): Promise<BookingWithOffering>;
  // updateBookingStatus: follows the transitions in status.ts; throws BookingStatusError otherwise
  updateBookingStatus(businessId: string, bookingId: string, status: BookingStatus): Promise<BookingWithOffering>;
}
