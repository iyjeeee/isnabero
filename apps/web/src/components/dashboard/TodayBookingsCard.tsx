import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { useBookings } from "@isnabero/module-booking";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@isnabero/ui";
import { supabase } from "@/lib/supabase";
import { useFormat, useLabels, useT } from "@/i18n";

const STATUS_VARIANT = { pending: "warning", confirmed: "info", completed: "success", cancelled: "secondary" } as const;

// TodayBookingsCard: today's bookings in time order (cancelled ones last), with a link through to the Booking page
export function TodayBookingsCard({ businessId }: { businessId: string }) {
  const { t } = useT();
  const labels = useLabels();
  const format = useFormat();
  const [from, to] = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setMilliseconds(-1);
    return [start.toISOString(), end.toISOString()];
  }, []);
  const { data: bookings = [], isLoading } = useBookings(supabase, businessId, from, to);
  const sorted = [...bookings].sort((a, b) => Number(a.status === "cancelled") - Number(b.status === "cancelled") || new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return (
    <Card className="animate-slide-up">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-info" />
          {t("dashboard.todayBookings.title")}
        </CardTitle>
        <Link to="/app/booking" className="text-sm font-medium text-primary hover:underline">
          {t("dashboard.todayBookings.open")}
        </Link>
      </CardHeader>
      <CardContent>
        {!isLoading && sorted.length === 0 && <p className="text-sm text-muted-foreground">{t("dashboard.todayBookings.empty")}</p>}
        <ul className="space-y-2">
          {sorted.map((booking) => (
            <li key={booking.id} className="flex items-center gap-3 text-sm">
              <span className="w-16 shrink-0 font-medium tabular-nums">{format.time(new Date(booking.startTime))}</span>
              <span className="min-w-0 flex-1 truncate">
                {booking.customerName} <span className="text-muted-foreground">· {booking.offering.name}</span>
              </span>
              <Badge variant={STATUS_VARIANT[booking.status]}>{labels.bookingStatus(booking.status)}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
