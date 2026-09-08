import type { BookingWithOffering, NewBooking } from "./types";

export type CreateBookingInput = Omit<NewBooking, "businessId" | "id" | "createdAt" | "status">;

// BookingRepository: data-access contract for the Booking module.
export interface BookingRepository {
  listBookings(businessId: string, from: string, to: string): Promise<BookingWithOffering[]>;
  createBooking(businessId: string, input: CreateBookingInput): Promise<BookingWithOffering>;
}
