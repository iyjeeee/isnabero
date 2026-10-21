import { useMemo, useState } from "react";
import { CalendarClock, Clock, User, CalendarCheck2, Search } from "lucide-react";
import { isEditable, useBookings } from "@isnabero/module-booking";
import { Badge, Card, CardContent, PageHeader, EmptyState, Skeleton, StatCard, FilterBar, Input, cn } from "@isnabero/ui";
import { supabase } from "@/lib/supabase";
import { useBusinessStore } from "@/stores/business-store";
import { ExportButton } from "@/components/ExportButton";
import { bookingRows } from "@/lib/export-rows";
import { NewBookingModal } from "@/components/booking/NewBookingModal";
import { BookingActions } from "@/components/booking/BookingActions";
import { useFormat, useLabels, useT } from "@/i18n";
import { formatPeso } from "@/lib/money";
import { BookingDetailDialog } from "@/components/details/BookingDetailDialog";
import { OPEN_CLASS, openProps } from "@/components/details/open-props";

const STATUS_VARIANT = { pending: "warning", confirmed: "info", completed: "success", cancelled: "destructive" } as const;

const UPCOMING_DAYS = 30;

export default function BookingPage() {
  const { t } = useT();
  const labels = useLabels();
  const f = useFormat();
  // formatBookingTime: "9:30 AM" for today, "Tue, Oct 6 · 9:30 AM" for later days (in the chosen language)
  const formatBookingTime = (value: Date | string): string => {
    const date = new Date(value);
    const time = f.time(date);
    if (date.toDateString() === new Date().toDateString()) return time;
    return `${f.weekday(date)}, ${f.monthDay(date)} · ${time}`;
  };
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const [detailId, setDetailId] = useState<string | null>(null);

  // Window = start of today through the next UPCOMING_DAYS days, so a booking made for tomorrow shows up
  // right after it's created instead of vanishing (the page used to cover today only).
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfWindow = new Date(startOfDay);
  endOfWindow.setDate(endOfWindow.getDate() + UPCOMING_DAYS + 1); // +1 so day 30 is included in full
  endOfWindow.setMilliseconds(-1);
  const { data: bookings = [], isLoading } = useBookings(
    supabase,
    businessId,
    startOfDay.toISOString(),
    endOfWindow.toISOString(),
  );

  const [search, setSearch] = useState("");
  const filteredBookings = useMemo(
    () => bookings.filter((booking) => booking.customerName.toLowerCase().includes(search.toLowerCase())),
    [bookings, search],
  );

  const todayCount = bookings.filter((booking) => booking.status !== "cancelled" && new Date(booking.startTime).toDateString() === new Date().toDateString()).length;
  const confirmedCount = bookings.filter((booking) => booking.status === "confirmed").length;
  const nextBooking = bookings.find((booking) => isEditable(booking.status) && new Date(booking.startTime) >= new Date());

  return (
    <div className="space-y-5">
      <PageHeader icon={CalendarClock} title={t("booking.title")} description={t("booking.description")}
        action={
          <div className="flex items-center gap-2">
            <ExportButton title="Bookings" filenamePrefix="bookings" withDateRange hint={t("booking.exportHint")} disabled={filteredBookings.length === 0} buildRows={(range) => bookingRows(filteredBookings, range)} />
            <NewBookingModal businessId={businessId} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("booking.stats.today")} value={todayCount} icon={CalendarClock} accent="default" isLoading={isLoading} />
        <StatCard label={t("booking.stats.confirmed")} value={confirmedCount} icon={CalendarCheck2} accent="success" isLoading={isLoading} />
        <StatCard
          label={t("booking.stats.next")}
          value={nextBooking ? <span className="text-base sm:text-lg">{formatBookingTime(nextBooking.startTime)}</span> : "—"}
          icon={Clock}
          accent="info"
          isLoading={isLoading}
        />
      </div>

      {bookings.length > 0 && (
        <FilterBar className="sm:justify-start">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t("booking.searchPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
          </div>
        </FilterBar>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {isLoading && (
          <div className="space-y-2 xl:col-span-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        )}
        {!isLoading && bookings.length === 0 && (
          <EmptyState icon={CalendarClock} title={t("booking.empty.title")} description={t("booking.empty.description")} className="xl:col-span-2" />
        )}
        {!isLoading && bookings.length > 0 && filteredBookings.length === 0 && (
          <EmptyState icon={Search} title={t("booking.noMatches.title")} description={t("booking.noMatches.description")} className="xl:col-span-2" />
        )}
        {filteredBookings.map((booking) => (
          <Card key={booking.id} interactive {...openProps(() => setDetailId(booking.id))} title={t("details.open", { name: booking.customerName })} className={cn(OPEN_CLASS, booking.status === "cancelled" && "opacity-60")}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{booking.customerName}</p>
                  <p className="truncate text-sm text-muted-foreground">{booking.offering.name} · {formatPeso(booking.offering.price)}</p>
                  {booking.customerContact && <p className="truncate text-xs text-muted-foreground">{booking.customerContact}</p>}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
                <Badge variant={STATUS_VARIANT[booking.status]}>{labels.bookingStatus(booking.status)}</Badge>
                <div className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {formatBookingTime(booking.startTime)}
                </div>
                <BookingActions businessId={businessId} booking={booking} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <BookingDetailDialog booking={bookings.find((booking) => booking.id === detailId) ?? null} onClose={() => setDetailId(null)} />
    </div>
  );
}
