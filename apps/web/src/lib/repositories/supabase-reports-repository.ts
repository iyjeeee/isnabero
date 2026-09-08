import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReportsRepository,
  SalesReportData,
  BookingReportData,
  CatalogReportData,
  DailyPoint,
} from "./reports-repository";

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

export function createSupabaseReportsRepository(supabase: SupabaseClient): ReportsRepository {
  return {
    async getSalesReport(businessId, days = 14): Promise<SalesReportData> {
      const cutoff = cutoffDate(days);
      const { data, error } = await supabase
        .from("payment_records")
        .select("amount, method, created_at, voided_at")
        .eq("business_id", businessId)
        .gte("created_at", cutoff.toISOString());
      if (error) throw error;

      const rows = data ?? [];
      const active = rows.filter((row: any) => !row.voided_at);

      const revenueByDate = new Map<string, number>();
      const revenueByMethod = new Map<string, number>();
      for (const row of active) {
        const key = toDateKey(new Date(row.created_at));
        revenueByDate.set(key, (revenueByDate.get(key) ?? 0) + Number(row.amount));
        revenueByMethod.set(row.method, (revenueByMethod.get(row.method) ?? 0) + Number(row.amount));
      }
      const totalRevenue = active.reduce((sum: number, row: any) => sum + Number(row.amount), 0);

      return {
        dailyRevenue: buildDailySeries(days, revenueByDate),
        methodBreakdown: Array.from(revenueByMethod.entries()).map(([label, value]) => ({ label, value })),
        totalRevenue,
        transactionCount: active.length,
        averageSale: active.length > 0 ? totalRevenue / active.length : 0,
        voidedCount: rows.length - active.length,
      };
    },

    async getBookingReport(businessId, days = 14): Promise<BookingReportData> {
      const cutoff = cutoffDate(days);
      const { data: allBookings, error: allError } = await supabase
        .from("bookings")
        .select("status, start_time")
        .eq("business_id", businessId);
      if (allError) throw allError;

      const rows = allBookings ?? [];
      const inRange = rows.filter((row: any) => new Date(row.start_time) >= cutoff);

      const countByDate = new Map<string, number>();
      for (const row of inRange) {
        const key = toDateKey(new Date(row.start_time));
        countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
      }

      const now = new Date();
      const upcomingCount = rows.filter((r: any) => new Date(r.start_time) >= now && (r.status === "pending" || r.status === "confirmed")).length;
      const completedCount = rows.filter((r: any) => r.status === "completed").length;
      const cancelledCount = rows.filter((r: any) => r.status === "cancelled").length;
      const pendingCount = rows.filter((r: any) => r.status === "pending").length;
      const confirmedCount = rows.filter((r: any) => r.status === "confirmed").length;

      return {
        dailyBookings: buildDailySeries(days, countByDate),
        statusBreakdown: [
          { label: "Pending", value: pendingCount },
          { label: "Confirmed", value: confirmedCount },
          { label: "Completed", value: completedCount },
          { label: "Cancelled", value: cancelledCount },
        ],
        totalBookings: rows.length,
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

      const { data: orders, error: ordersError } = await supabase
        .from("pos_orders")
        .select("id")
        .eq("business_id", businessId)
        .neq("status", "voided");
      if (ordersError) throw ordersError;

      const orderIds = (orders ?? []).map((order: any) => order.id);
      let items: any[] = [];
      if (orderIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from("pos_order_items")
          .select("offering_id, quantity, unit_price")
          .in("order_id", orderIds);
        if (itemsError) throw itemsError;
        items = itemsData ?? [];
      }

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
