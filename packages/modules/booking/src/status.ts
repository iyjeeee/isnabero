// Booking lifecycle: pending -> confirmed -> completed, and either open state can be cancelled. Completed and cancelled are final
// (a cancelled slot may have been rebooked, so it can't be revived). The database enforces the same table (migration 0011).
export const BOOKING_STATUSES = ["pending", "confirmed", "completed", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

// nextStatuses: what a booking in this status can move to (empty for final statuses)
export function nextStatuses(status: string): readonly BookingStatus[] {
  return TRANSITIONS[status as BookingStatus] ?? [];
}

export function canTransition(from: string, to: string): boolean {
  return nextStatuses(from).includes(to as BookingStatus);
}

// isEditable: details (customer, package, time) can only change while the booking is still open
export function isEditable(status: string): boolean {
  return status === "pending" || status === "confirmed";
}

// BookingStatusError: thrown by both repositories for an impossible change; the message is user-facing
export class BookingStatusError extends Error {
  constructor(from: string, to: string) {
    super(`A ${from} booking can't be changed to ${to}.`);
    this.name = "BookingStatusError";
  }
}

export const BOOKING_NOT_EDITABLE_MESSAGE = "Only pending or confirmed bookings can be edited.";
