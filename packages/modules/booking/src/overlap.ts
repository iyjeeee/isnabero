// Booking rule: two bookings in the same business can't share a time slot. Back-to-back is allowed
// (one ends exactly when the next starts) and cancelled bookings free their slot.

export interface TimeRange {
  startTime: Date;
  endTime: Date;
}

export interface BookingConflict extends TimeRange {
  customerName: string;
}

// rangesOverlap: half-open [start, end) comparison, matching the DB exclusion constraint (tstzrange default)
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.startTime < b.endTime && b.startTime < a.endTime;
}

// blocksSlot: cancelled bookings no longer hold their time slot
export function blocksSlot(status: string): boolean {
  return status !== "cancelled";
}

// assertValidRange: guards bad input before any conflict check or DB write
export function assertValidRange(range: TimeRange): void {
  if (Number.isNaN(range.startTime.getTime()) || Number.isNaN(range.endTime.getTime()) || range.endTime <= range.startTime) {
    throw new Error("The booking's end time must be after its start time.");
  }
}

// BookingConflictError: thrown by every BookingRepository.createBooking when the slot is taken; the message
// is user-facing (the global mutation error toast shows it as-is)
export class BookingConflictError extends Error {
  constructor(public readonly conflict?: BookingConflict) {
    super(
      conflict
        ? `That time overlaps ${conflict.customerName}'s booking (${formatRange(conflict)}). Pick a different time.`
        : "That time overlaps an existing booking. Pick a different time.",
    );
    this.name = "BookingConflictError";
  }
}

function formatRange({ startTime, endTime }: TimeRange): string {
  const date = startTime.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = (value: Date) => value.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time(startTime)}–${time(endTime)}`;
}
