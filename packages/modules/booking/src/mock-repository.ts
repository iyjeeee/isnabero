import { mockDb, delay, genId, recordAudit } from "@isnabero/db";
import type { BookingRepository, CreateBookingInput, UpdateBookingInput } from "./repository";
import { BOOKING_NOT_EDITABLE_MESSAGE, BookingStatusError, canTransition, isEditable, type BookingStatus } from "./status";
import type { BookingWithOffering } from "./types";
import { BookingConflictError, assertValidRange, blocksSlot, rangesOverlap } from "./overlap";

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
    const range = { startTime: new Date(input.startTime as unknown as string | Date), endTime: new Date(input.endTime as unknown as string | Date) };
    assertValidRange(range);
    const conflict = mockDb.bookings.find(
      (existing) => existing.businessId === businessId && blocksSlot(existing.status) && rangesOverlap(existing, range),
    );
    if (conflict) throw new BookingConflictError(conflict);
    const booking = {
      id: genId(),
      businessId,
      offeringId: input.offeringId,
      mode: input.mode ?? "appointment",
      customerName: input.customerName,
      customerContact: input.customerContact ?? null,
      startTime: range.startTime,
      endTime: range.endTime,
      status: "pending" as const,
      paymentRecordId: input.paymentRecordId ?? null,
      createdAt: new Date(),
    };
    mockDb.bookings.push(booking);
    const created = withOffering(booking);
    recordAudit({ businessId, action: "booking.created", entityId: booking.id, summary: `Booked ${created.offering.name} for ${booking.customerName}` });
    return created;
  },

  async updateBooking(businessId, bookingId, input: UpdateBookingInput) {
    await delay(400);
    const booking = mockDb.bookings.find((item) => item.id === bookingId && item.businessId === businessId);
    if (!booking) throw new Error("Booking not found");
    if (!isEditable(booking.status)) throw new Error(BOOKING_NOT_EDITABLE_MESSAGE);
    const range = { startTime: new Date(input.startTime as unknown as string | Date), endTime: new Date(input.endTime as unknown as string | Date) };
    assertValidRange(range);
    const conflict = mockDb.bookings.find(
      (existing) => existing.id !== bookingId && existing.businessId === businessId && blocksSlot(existing.status) && rangesOverlap(existing, range),
    );
    if (conflict) throw new BookingConflictError(conflict);
    Object.assign(booking, {
      offeringId: input.offeringId,
      customerName: input.customerName,
      customerContact: input.customerContact ?? null,
      startTime: range.startTime,
      endTime: range.endTime,
    });
    const updated = withOffering(booking);
    recordAudit({ businessId, action: "booking.updated", entityId: booking.id, summary: `Updated booking for ${booking.customerName} (${updated.offering.name})` });
    return updated;
  },

  async updateBookingStatus(businessId, bookingId, status: BookingStatus) {
    await delay(250);
    const booking = mockDb.bookings.find((item) => item.id === bookingId && item.businessId === businessId);
    if (!booking) throw new Error("Booking not found");
    if (!canTransition(booking.status, status)) throw new BookingStatusError(booking.status, status);
    const from = booking.status;
    booking.status = status;
    const updated = withOffering(booking);
    recordAudit({ businessId, action: "booking.status_changed", entityId: booking.id, summary: `Booking for ${booking.customerName} (${updated.offering.name}): ${from} → ${status}` });
    return updated;
  },
};
