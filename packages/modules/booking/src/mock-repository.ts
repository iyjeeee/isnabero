import { mockDb, delay, genId } from "@isnabero/db";
import type { BookingRepository, CreateBookingInput } from "./repository";
import type { BookingWithOffering } from "./types";

function withOffering(booking: (typeof mockDb.bookings)[number]): BookingWithOffering {
  const offering = mockDb.offerings.find((item) => item.id === booking.offeringId);
  const inclusions = mockDb.offeringInclusions.filter((inclusion) => inclusion.offeringId === booking.offeringId);
  return { ...booking, offering: { ...offering!, inclusions } } as BookingWithOffering;
}

export const mockBookingRepository: BookingRepository = {
  async listBookings(businessId, from, to) {
    await delay();
    const fromTime = new Date(from).getTime();
    const toTime = new Date(to).getTime();
    return mockDb.bookings
      .filter((booking) => booking.businessId === businessId)
      .filter((booking) => booking.startTime.getTime() >= fromTime && booking.startTime.getTime() <= toTime)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .map(withOffering);
  },

  async createBooking(businessId, input: CreateBookingInput) {
    await delay(400);
    const booking = {
      id: genId(),
      businessId,
      offeringId: input.offeringId,
      mode: input.mode ?? "appointment",
      customerName: input.customerName,
      customerContact: input.customerContact ?? null,
      startTime: new Date(input.startTime as unknown as string | Date),
      endTime: new Date(input.endTime as unknown as string | Date),
      status: "pending" as const,
      paymentRecordId: input.paymentRecordId ?? null,
      createdAt: new Date(),
    };
    mockDb.bookings.push(booking);
    return withOffering(booking);
  },
};
