import { useMemo, useState } from "react";
import { CalendarClock, Clock, User, CalendarCheck2, Search } from "lucide-react";
import { useBookings } from "@isnabero/module-booking";
import { Card, CardContent, PageHeader, EmptyState, Skeleton, StatCard, FilterBar, Input } from "@isnabero/ui";
import { supabase } from "@/lib/supabase";
import { useBusinessStore } from "@/stores/business-store";
import { NewBookingModal } from "@/components/booking/NewBookingModal";

export default function BookingPage() {
  const businessId = useBusinessStore((state) => state.businessId) ?? "";

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const { data: bookings = [], isLoading } = useBookings(
    supabase,
    businessId,
    startOfDay.toISOString(),
    endOfDay.toISOString(),
  );

  const [search, setSearch] = useState("");
  const filteredBookings = useMemo(
    () => bookings.filter((booking) => booking.customerName.toLowerCase().includes(search.toLowerCase())),
    [bookings, search],
  );

  const confirmedCount = bookings.filter((booking) => booking.status === "confirmed").length;
  const nextBooking = bookings.find((booking) => new Date(booking.startTime) >= new Date());

  return (
    <div className="space-y-6">
      <PageHeader icon={CalendarClock} title="Booking" description="Today's appointments." action={<NewBookingModal businessId={businessId} />} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Today's Bookings" value={bookings.length} icon={CalendarClock} accent="default" isLoading={isLoading} />
        <StatCard label="Confirmed" value={confirmedCount} icon={CalendarCheck2} accent="success" isLoading={isLoading} />
        <StatCard
          label="Next Booking"
          value={nextBooking ? new Date(nextBooking.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
          icon={Clock}
          accent="info"
          isLoading={isLoading}
        />
      </div>

      {bookings.length > 0 && (
        <FilterBar className="sm:justify-start">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by customer name…" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
          </div>
        </FilterBar>
      )}

      <div className="space-y-3">
        {isLoading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        )}
        {!isLoading && bookings.length === 0 && (
          <EmptyState icon={CalendarClock} title="No bookings today" description="Tap New Booking to reserve the first slot." />
        )}
        {!isLoading && bookings.length > 0 && filteredBookings.length === 0 && (
          <EmptyState icon={Search} title="No matches" description="Try a different search term." />
        )}
        {filteredBookings.map((booking) => (
          <Card key={booking.id} interactive>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{booking.customerName}</p>
                  <p className="truncate text-sm text-muted-foreground">{booking.offering.name}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {new Date(booking.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
