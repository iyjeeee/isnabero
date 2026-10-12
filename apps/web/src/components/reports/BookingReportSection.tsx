import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { CalendarClock, CalendarCheck2, CalendarX2, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Skeleton, TrendBadge } from "@isnabero/ui";
import { supabase } from "@/lib/supabase";
import { getReportsRepository } from "@/lib/repositories/get-reports-repository";
import { useT, useFormat, useLabels } from "@/i18n";
import { CHART_COLORS, STATUS_COLORS } from "@/lib/chart-colors";
import { computePercentChange } from "@/lib/percent-change";

interface BookingReportSectionProps {
  businessId: string;
}

export function BookingReportSection({ businessId }: BookingReportSectionProps) {
  const { t } = useT();
  const format = useFormat();
  const labels = useLabels();
  const repository = getReportsRepository(supabase);
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "booking", businessId],
    queryFn: () => repository.getBookingReport(businessId, 14),
    enabled: Boolean(businessId),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" />
          {t("reports.booking.title")}
          <span className="text-sm font-normal text-muted-foreground">{t("reports.last14Days")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && <Skeleton className="h-64 w-full" />}
        {!isLoading && data && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <CalendarDays className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("reports.booking.thisPeriod")}</p>
                  <p className="font-semibold">{data.dailyBookings.reduce((sum, point) => sum + point.value, 0)}</p>
                  <TrendBadge
                    percentChange={computePercentChange(
                      data.dailyBookings.reduce((sum, point) => sum + point.value, 0),
                      data.previousPeriodCount,
                    )}
                    className="mt-0.5"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <CalendarClock className="h-4 w-4 text-info" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("reports.booking.upcoming")}</p>
                  <p className="font-semibold">{data.upcomingCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <CalendarCheck2 className="h-4 w-4 text-success" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("reports.booking.completed")}</p>
                  <p className="font-semibold">{data.completedCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <CalendarX2 className="h-4 w-4 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("reports.booking.cancelled")}</p>
                  <p className="font-semibold">{data.cancelledCount}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="h-64 lg:col-span-2">
                <p className="mb-2 text-sm font-medium text-muted-foreground">{t("reports.booking.perDay")}</p>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={data.dailyBookings}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="date" tickFormatter={(value: string) => format.monthDay(value)} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" width={30} allowDecimals={false} />
                    <Tooltip formatter={(value: number) => [value, t("reports.booking.bookings")]} labelFormatter={(label) => t("reports.date", { date: format.date(String(label)) })} />
                    <Bar dataKey="value" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="h-64">
                <p className="mb-2 text-sm font-medium text-muted-foreground">{t("reports.booking.byStatus")}</p>
                {data.totalBookings === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("reports.booking.none")}</p>
                ) : (
                  <ResponsiveContainer width="100%" height="90%">
                    <PieChart>
                      <Pie data={data.statusBreakdown.filter((s) => s.value > 0).map((s) => ({ ...s, name: labels.bookingStatus(s.label.toLowerCase()) }))} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                        {data.statusBreakdown
                          .filter((s) => s.value > 0)
                          .map((entry) => (
                            <Cell key={entry.label} fill={STATUS_COLORS[entry.label] ?? CHART_COLORS[4]} />
                          ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
