import { describe, it, expect } from "vitest";
import { mockReportsRepository } from "../mock-reports-repository";
import { mockDb, DEMO_BUSINESS_ID } from "@isnabero/db";

describe("mockReportsRepository.getSalesReport", () => {
  it("only counts active (non-voided) records in totals, and reports the voided count separately", async () => {
    const before = await mockReportsRepository.getSalesReport(DEMO_BUSINESS_ID, 30);

    mockDb.paymentRecords.push({
      id: "report-test-active",
      businessId: DEMO_BUSINESS_ID,
      sourceModule: "pos",
      method: "cash",
      referenceCode: null,
      amount: "500.00",
      createdAt: new Date(),
      voidedAt: null,
    });
    mockDb.paymentRecords.push({
      id: "report-test-voided",
      businessId: DEMO_BUSINESS_ID,
      sourceModule: "pos",
      method: "cash",
      referenceCode: null,
      amount: "999.00",
      createdAt: new Date(),
      voidedAt: new Date(),
    });

    const after = await mockReportsRepository.getSalesReport(DEMO_BUSINESS_ID, 30);
    expect(after.totalRevenue).toBe(before.totalRevenue + 500);
    expect(after.transactionCount).toBe(before.transactionCount + 1);
    expect(after.voidedCount).toBe(before.voidedCount + 1);
  });

  it("returns a daily series covering exactly the requested number of days", async () => {
    const report = await mockReportsRepository.getSalesReport(DEMO_BUSINESS_ID, 7);
    expect(report.dailyRevenue).toHaveLength(7);
  });

  it("computes previousPeriodRevenue from the window immediately before the current one, without it leaking into totalRevenue", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);

    const before = await mockReportsRepository.getSalesReport(DEMO_BUSINESS_ID, 1);

    mockDb.paymentRecords.push({
      id: "report-test-previous-period",
      businessId: DEMO_BUSINESS_ID,
      sourceModule: "pos",
      method: "cash",
      referenceCode: null,
      amount: "321.00",
      createdAt: yesterday,
      voidedAt: null,
    });

    // days=1 means "today only" — the record we just added (yesterday) should land in the previous
    // period's total, and NOT affect today's totalRevenue at all.
    const after = await mockReportsRepository.getSalesReport(DEMO_BUSINESS_ID, 1);
    expect(after.previousPeriodRevenue).toBe(before.previousPeriodRevenue + 321);
    expect(after.totalRevenue).toBe(before.totalRevenue);
  });
});

describe("mockReportsRepository.getBookingReport", () => {
  it("breaks bookings down by status", async () => {
    const report = await mockReportsRepository.getBookingReport(DEMO_BUSINESS_ID, 30);
    const totalFromBreakdown = report.statusBreakdown.reduce((sum, slice) => sum + slice.value, 0);
    expect(totalFromBreakdown).toBeGreaterThan(0);
    expect(report.statusBreakdown.map((s) => s.label)).toEqual(["Pending", "Confirmed", "Completed", "Cancelled"]);
  });

  it("computes previousPeriodCount from bookings in the window immediately before the current one", async () => {
    const bundleOffering = mockDb.offerings.find((o) => o.businessId === DEMO_BUSINESS_ID && o.durationMinutes)!;
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(12, 0, 0, 0);

    const before = await mockReportsRepository.getBookingReport(DEMO_BUSINESS_ID, 2);

    mockDb.bookings.push({
      id: "report-test-prev-booking",
      businessId: DEMO_BUSINESS_ID,
      offeringId: bundleOffering.id,
      mode: "appointment",
      customerName: "Previous Period Test",
      customerContact: null,
      startTime: twoDaysAgo,
      endTime: new Date(twoDaysAgo.getTime() + 30 * 60000),
      status: "completed",
      paymentRecordId: null,
      createdAt: twoDaysAgo,
    });

    const after = await mockReportsRepository.getBookingReport(DEMO_BUSINESS_ID, 2);
    expect(after.previousPeriodCount).toBe(before.previousPeriodCount + 1);
  });
});

describe("mockReportsRepository.getCatalogReport", () => {
  it("ranks top offerings by quantity sold, descending", async () => {
    const report = await mockReportsRepository.getCatalogReport(DEMO_BUSINESS_ID);
    for (let i = 1; i < report.topOfferings.length; i++) {
      expect(report.topOfferings[i - 1]!.quantitySold).toBeGreaterThanOrEqual(report.topOfferings[i]!.quantitySold);
    }
  });

  it("counts available vs sold-out offerings correctly", async () => {
    const report = await mockReportsRepository.getCatalogReport(DEMO_BUSINESS_ID);
    expect(report.availableCount + report.soldOutCount).toBe(report.totalOfferings);
    // The seed data intentionally marks "Iced Tea" sold out
    expect(report.soldOutCount).toBeGreaterThanOrEqual(1);
  });
});
