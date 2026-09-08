import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { CalendarClock, CalendarCheck2, CalendarX2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@isnabero/ui";
import { supabase } from "@/lib/supabase";
import { getReportsRepository } from "@/lib/repositories/get-reports-repository";
import { CHART_COLORS, STATUS_COLORS } from "@/lib/chart-colors";

interface BookingReportSectionProps {
  businessId: string;
}

export function BookingReportSection({ businessId }: BookingReportSectionProps) {
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
          Booking Report
          <span className="text-sm font-normal text-muted-foreground">— last 14 days</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && <Skeleton className="h-64 w-full" />}
        {!isLoading && data && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <CalendarClock className="h-4 w-4 text-info" />
                <div>
                  <p className="text-xs text-muted-foreground">Upcoming</p>
                  <p className="font-semibold">{data.upcomingCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <CalendarCheck2 className="h-4 w-4 text-success" />
                <div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="font-semibold">{data.completedCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <CalendarX2 className="h-4 w-4 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">Cancelled</p>
                  <p className="font-semibold">{data.cancelledCount}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="h-64 lg:col-span-2">
                <p className="mb-2 text-sm font-medium text-muted-foreground">Bookings per day</p>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={data.dailyBookings}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" width={30} allowDecimals={false} />
                    <Tooltip formatter={(value: number) => [value, "Bookings"]} labelFormatter={(label) => `Date: ${label}`} />
                    <Bar dataKey="value" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="h-64">
                <p className="mb-2 text-sm font-medium text-muted-foreground">By status (all time)</p>
                {data.totalBookings === 0 ? (
                  <p className="text-sm text-muted-foreground">No bookings yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="90%">
                    <PieChart>
                      <Pie data={data.statusBreakdown.filter((s) => s.value > 0)} dataKey="value" nameKey="label" innerRadius={40} outerRadius={70} paddingAngle={2}>
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
