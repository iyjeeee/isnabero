// Helpers for the booking form (create + edit), kept apart from the modal so they can be unit-tested.
export const DEFAULT_BOOKING_MINUTES = 60;

// toDateTimeLocal: a Date as the local "YYYY-MM-DDTHH:mm" an <input type="datetime-local"> expects
export function toDateTimeLocal(value: Date | string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// bookingMinutes: how long the booking lasts. An edit keeps its current length unless the package changed,
// then the new package's duration applies (same rule as creating one).
export function bookingMinutes({ offeringDuration, existing }: { offeringDuration: number | null; existing?: { startTime: Date | string; endTime: Date | string; offeringChanged: boolean } }): number {
  if (existing && !existing.offeringChanged) return Math.round((new Date(existing.endTime).getTime() - new Date(existing.startTime).getTime()) / 60000);
  return offeringDuration ?? DEFAULT_BOOKING_MINUTES;
}
