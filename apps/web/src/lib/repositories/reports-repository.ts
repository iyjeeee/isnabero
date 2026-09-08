export interface DailyPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface BreakdownSlice {
  label: string;
  value: number;
}

export interface SalesReportData {
  dailyRevenue: DailyPoint[];
  methodBreakdown: BreakdownSlice[];
  totalRevenue: number;
  transactionCount: number;
  averageSale: number;
  voidedCount: number;
}

export interface BookingReportData {
  dailyBookings: DailyPoint[];
  statusBreakdown: BreakdownSlice[];
  totalBookings: number;
  upcomingCount: number;
  completedCount: number;
  cancelledCount: number;
}

export interface TopOffering {
  name: string;
  quantitySold: number;
  revenue: number;
}

export interface CatalogReportData {
  topOfferings: TopOffering[];
  availableCount: number;
  soldOutCount: number;
  totalOfferings: number;
}

// ReportsRepository: read-only aggregation queries backing the three Reports page sections. Kept
// separate from CoreRepository since these are cross-table aggregates specific to reporting, not
// simple CRUD on one table.
export interface ReportsRepository {
  getSalesReport(businessId: string, days?: number): Promise<SalesReportData>;
  getBookingReport(businessId: string, days?: number): Promise<BookingReportData>;
  getCatalogReport(businessId: string): Promise<CatalogReportData>;
}
