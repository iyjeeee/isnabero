import { mockDb, delay } from "@isnabero/db";
import type {
  ReportsRepository,
  SalesReportData,
  BookingReportData,
  CatalogReportData,
  DailyPoint,
} from "./reports-repository";

// toDateKey: local YYYY-MM-DD (not UTC) so "today" in the chart matches what the person sees on screen
function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// buildDailySeries: fills in every day in the range with 0 where there's no data, so the chart doesn't
// have gaps or misleading compressed spacing on quiet days.
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

export const mockReportsRepository: ReportsRepository = {
  async getSalesReport(businessId, days = 14): Promise<SalesReportData> {
    await delay();
    const cutoff = cutoffDate(days);
    const inRange = mockDb.paymentRecords.filter((record) => record.businessId === businessId && record.createdAt >= cutoff);
    const active = inRange.filter((record) => !record.voidedAt);

    const revenueByDate = new Map<string, number>();
    const revenueByMethod = new Map<string, number>();
    for (const record of active) {
      const key = toDateKey(record.createdAt);
      revenueByDate.set(key, (revenueByDate.get(key) ?? 0) + Number(record.amount));
      revenueByMethod.set(record.method, (revenueByMethod.get(record.method) ?? 0) + Number(record.amount));
    }

    const totalRevenue = active.reduce((sum, record) => sum + Number(record.amount), 0);

    return {
      dailyRevenue: buildDailySeries(days, revenueByDate),
      methodBreakdown: Array.from(revenueByMethod.entries()).map(([label, value]) => ({ label, value })),
      totalRevenue,
      transactionCount: active.length,
      averageSale: active.length > 0 ? totalRevenue / active.length : 0,
      voidedCount: inRange.length - active.length,
    };
  },

  async getBookingReport(businessId, days = 14): Promise<BookingReportData> {
    await delay();
    const cutoff = cutoffDate(days);
    const businessBookings = mockDb.bookings.filter((booking) => booking.businessId === businessId);
    const inRange = businessBookings.filter((booking) => booking.startTime >= cutoff);

    const countByDate = new Map<string, number>();
    for (const booking of inRange) {
      const key = toDateKey(booking.startTime);
      countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
    }

    const now = new Date();
    const upcomingCount = businessBookings.filter((b) => b.startTime >= now && (b.status === "pending" || b.status === "confirmed")).length;
    const completedCount = businessBookings.filter((b) => b.status === "completed").length;
    const cancelledCount = businessBookings.filter((b) => b.status === "cancelled").length;
    const pendingCount = businessBookings.filter((b) => b.status === "pending").length;
    const confirmedCount = businessBookings.filter((b) => b.status === "confirmed").length;

    return {
      dailyBookings: buildDailySeries(days, countByDate),
      statusBreakdown: [
        { label: "Pending", value: pendingCount },
        { label: "Confirmed", value: confirmedCount },
        { label: "Completed", value: completedCount },
        { label: "Cancelled", value: cancelledCount },
      ],
      totalBookings: businessBookings.length,
      upcomingCount,
      completedCount,
      cancelledCount,
    };
  },

  async getCatalogReport(businessId): Promise<CatalogReportData> {
    await delay();
    const businessOfferings = mockDb.offerings.filter((offering) => offering.businessId === businessId);
    const businessOrderIds = new Set(mockDb.posOrders.filter((order) => order.businessId === businessId && order.status !== "voided").map((order) => order.id));

    const totalsByOffering = new Map<string, { quantitySold: number; revenue: number }>();
    for (const item of mockDb.posOrderItems) {
      if (!businessOrderIds.has(item.orderId)) continue;
      const existing = totalsByOffering.get(item.offeringId) ?? { quantitySold: 0, revenue: 0 };
      existing.quantitySold += item.quantity;
      existing.revenue += item.quantity * Number(item.unitPrice);
      totalsByOffering.set(item.offeringId, existing);
    }

    const topOfferings = Array.from(totalsByOffering.entries())
      .map(([offeringId, totals]) => {
        const offering = businessOfferings.find((o) => o.id === offeringId);
        return { name: offering?.name ?? "Unknown offering", ...totals };
      })
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5);

    return {
      topOfferings,
      availableCount: businessOfferings.filter((o) => o.isAvailable).length,
      soldOutCount: businessOfferings.filter((o) => !o.isAvailable).length,
      totalOfferings: businessOfferings.length,
    };
  },
};
