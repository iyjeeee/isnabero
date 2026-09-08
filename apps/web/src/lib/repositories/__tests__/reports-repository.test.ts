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
});

describe("mockReportsRepository.getBookingReport", () => {
  it("breaks bookings down by status", async () => {
    const report = await mockReportsRepository.getBookingReport(DEMO_BUSINESS_ID, 30);
    const totalFromBreakdown = report.statusBreakdown.reduce((sum, slice) => sum + slice.value, 0);
    expect(totalFromBreakdown).toBeGreaterThan(0);
    expect(report.statusBreakdown.map((s) => s.label)).toEqual(["Pending", "Confirmed", "Completed", "Cancelled"]);
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
