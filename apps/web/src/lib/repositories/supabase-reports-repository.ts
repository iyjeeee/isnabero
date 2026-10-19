import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReportsRepository,
  SalesReportData,
  BookingReportData,
  CatalogReportData,
  DailyPoint,
} from "./reports-repository";
import { fetchAllRows } from "./paginate";

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildDailySeries(days: number, totalsByDate: Map<string, number>): DailyPoint[] {
  const series: DailyPoint[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    const key = toDateKey(day);
    series.push({ date: key, value: totalsByDate.get(key) ?? 0 });
  }
  return series;
}

function cutoffDate(days: number): Date {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  return cutoff;
}

// previousPeriodRange: the window immediately before the current one, same length — no overlap.
function previousPeriodRange(days: number): { start: Date; end: Date } {
  const currentStart = cutoffDate(days);
  const start = new Date(currentStart);
  start.setDate(start.getDate() - days);
  return { start, end: currentStart };
}

export function createSupabaseReportsRepository(supabase: SupabaseClient): ReportsRepository {
  return {
    async getSalesReport(businessId, days = 14): Promise<SalesReportData> {
      const cutoff = cutoffDate(days);
      const { start: prevStart } = previousPeriodRange(days);
      // One paged read covers the previous and the current period; they're split below (the previous one ends where the current starts)
      const all = await fetchAllRows<any>((from, to) =>
        supabase
          .from("payment_records")
          .select("id, amount, method, created_at, voided_at")
          .eq("business_id", businessId)
          .gte("created_at", prevStart.toISOString())
          .order("created_at")
          .order("id")
          .range(from, to),
      );
      const rows = all.filter((row) => new Date(row.created_at) >= cutoff);
      const active = rows.filter((row) => !row.voided_at);

      const revenueByDate = new Map<string, number>();
      const revenueByMethod = new Map<string, number>();
      for (const row of active) {
        const key = toDateKey(new Date(row.created_at));
        revenueByDate.set(key, (revenueByDate.get(key) ?? 0) + Number(row.amount));
        revenueByMethod.set(row.method, (revenueByMethod.get(row.method) ?? 0) + Number(row.amount));
      }
      const totalRevenue = active.reduce((sum: number, row: any) => sum + Number(row.amount), 0);

      const previousPeriodRevenue = all
        .filter((row) => new Date(row.created_at) < cutoff && !row.voided_at)
        .reduce((sum: number, row: any) => sum + Number(row.amount), 0);

      return {
        dailyRevenue: buildDailySeries(days, revenueByDate),
        methodBreakdown: Array.from(revenueByMethod.entries()).map(([label, value]) => ({ label, value })),
        totalRevenue,
        previousPeriodRevenue,
        transactionCount: active.length,
        averageSale: active.length > 0 ? totalRevenue / active.length : 0,
        voidedCount: rows.length - active.length,
      };
    },

    async getBookingReport(businessId, days = 14): Promise<BookingReportData> {
      const cutoff = cutoffDate(days);
      const { start: prevStart, end: prevEnd } = previousPeriodRange(days);

      // Totals come from head-only count queries (no rows transferred); only bookings from the previous period onward are read
      // in full — they feed the daily chart, the period comparison and the upcoming count.
      const countStatus = async (status?: string) => {
        let query = supabase.from("bookings").select("id", { count: "exact", head: true }).eq("business_id", businessId);
        if (status) query = query.eq("status", status);
        const { count, error } = await query;
        if (error) throw error;
        return count ?? 0;
      };
      const [windowRows, totalBookings, pendingCount, confirmedCount, completedCount, cancelledCount] = await Promise.all([
        fetchAllRows<any>((from, to) =>
          supabase.from("bookings").select("id, status, start_time").eq("business_id", businessId).gte("start_time", prevStart.toISOString()).order("start_time").order("id").range(from, to),
        ),
        countStatus(),
        countStatus("pending"),
        countStatus("confirmed"),
        countStatus("completed"),
        countStatus("cancelled"),
      ]);

      const inRange = windowRows.filter((row) => new Date(row.start_time) >= cutoff);
      const countByDate = new Map<string, number>();
      for (const row of inRange) {
        const key = toDateKey(new Date(row.start_time));
        countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
      }
      const previousPeriodCount = windowRows.filter((row) => {
        const startTime = new Date(row.start_time);
        return startTime >= prevStart && startTime < prevEnd;
      }).length;

      const now = new Date();
      const upcomingCount = windowRows.filter((row) => new Date(row.start_time) >= now && (row.status === "pending" || row.status === "confirmed")).length;

      return {
        dailyBookings: buildDailySeries(days, countByDate),
        statusBreakdown: [
          { label: "Pending", value: pendingCount },
          { label: "Confirmed", value: confirmedCount },
          { label: "Completed", value: completedCount },
          { label: "Cancelled", value: cancelledCount },
        ],
        totalBookings,
        previousPeriodCount,
        upcomingCount,
        completedCount,
        cancelledCount,
      };
    },

    async getCatalogReport(businessId): Promise<CatalogReportData> {
      const { data: offeringsData, error: offeringsError } = await supabase
        .from("offerings")
        .select("id, name, is_available")
        .eq("business_id", businessId);
      if (offeringsError) throw offeringsError;

      // One joined read instead of listing every order id in a URL (which breaks past a few hundred orders); voided sales are excluded
      const items = await fetchAllRows<any>((from, to) =>
        supabase
          .from("pos_order_items")
          .select("id, offering_id, quantity, unit_price, pos_orders!inner(business_id, status)")
          .eq("pos_orders.business_id", businessId)
          .neq("pos_orders.status", "voided")
          .order("id")
          .range(from, to),
      );

      const totalsByOffering = new Map<string, { quantitySold: number; revenue: number }>();
      for (const item of items) {
        const existing = totalsByOffering.get(item.offering_id) ?? { quantitySold: 0, revenue: 0 };
        existing.quantitySold += item.quantity;
        existing.revenue += item.quantity * Number(item.unit_price);
        totalsByOffering.set(item.offering_id, existing);
      }

      const offeringRows = offeringsData ?? [];
      const topOfferings = Array.from(totalsByOffering.entries())
        .map(([offeringId, totals]) => {
          const offering = offeringRows.find((o: any) => o.id === offeringId);
          return { name: offering?.name ?? "Unknown offering", ...totals };
        })
        .sort((a, b) => b.quantitySold - a.quantitySold)
        .slice(0, 5);

      return {
        topOfferings,
        availableCount: offeringRows.filter((o: any) => o.is_available).length,
        soldOutCount: offeringRows.filter((o: any) => !o.is_available).length,
        totalOfferings: offeringRows.length,
      };
    },
  };
}
