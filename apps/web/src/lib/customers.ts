import type { BookingWithOffering } from "@isnabero/module-booking";

// Customer: a person (or group) seen in bookings. There is no customers table: they are worked out from bookings, matched by
// contact number/handle when there is one, otherwise by name.
export interface Customer {
  key: string;
  name: string; // as written on the latest booking
  contact: string | null;
  bookings: BookingWithOffering[]; // newest first
  visits: number; // completed bookings
  cancelled: number;
  spent: number; // price of completed bookings
  lastVisit: Date | null; // latest completed booking
  next: Date | null; // earliest pending/confirmed booking from now on
}

// customerKey: contacts match on their letters and digits ("0917 123 4567" = "09171234567"), names match ignoring case and spacing
export function customerKey(name: string, contact: string | null): string {
  const cleanContact = (contact ?? "").toLowerCase().replace(/[^a-z0-9@._]/g, "");
  if (cleanContact) return `c:${cleanContact}`;
  return `n:${name.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

// groupCustomers: one row per customer, most recently active first
export function groupCustomers(bookings: BookingWithOffering[], now: Date = new Date()): Customer[] {
  const byKey = new Map<string, BookingWithOffering[]>();
  for (const booking of bookings) {
    const key = customerKey(booking.customerName, booking.customerContact ?? null);
    byKey.set(key, [...(byKey.get(key) ?? []), booking]);
  }
  const customers: Customer[] = [];
  for (const [key, list] of byKey) {
    const sorted = [...list].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    const completed = sorted.filter((booking) => booking.status === "completed");
    const upcoming = sorted.filter((booking) => (booking.status === "pending" || booking.status === "confirmed") && new Date(booking.startTime) >= now);
    const latest = sorted[0]!;
    customers.push({
      key,
      name: latest.customerName.trim(),
      contact: sorted.find((booking) => booking.customerContact)?.customerContact ?? null,
      bookings: sorted,
      visits: completed.length,
      cancelled: sorted.filter((booking) => booking.status === "cancelled").length,
      spent: Math.round(completed.reduce((sum, booking) => sum + Number(booking.offering.price), 0) * 100) / 100,
      lastVisit: completed[0] ? new Date(completed[0].startTime) : null,
      next: upcoming.length > 0 ? new Date(upcoming[upcoming.length - 1]!.startTime) : null,
    });
  }
  return customers.sort((a, b) => new Date(b.bookings[0]!.startTime).getTime() - new Date(a.bookings[0]!.startTime).getTime());
}
