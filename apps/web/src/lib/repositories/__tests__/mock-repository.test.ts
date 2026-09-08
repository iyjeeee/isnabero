import { describe, it, expect } from "vitest";
import { mockCoreRepository } from "../mock-repository";
import { mockDb, DEMO_BUSINESS_ID, DEMO_OWNER_USER_ID } from "@isnabero/db";

describe("mockCoreRepository — employees", () => {
  it("creates, updates, and deletes an employee", async () => {
    const created = await mockCoreRepository.createEmployee(DEMO_BUSINESS_ID, { fullName: "Test Person", role: "staff" });
    expect(created.fullName).toBe("Test Person");
    expect(created.role).toBe("staff");

    const listed = await mockCoreRepository.listEmployees(DEMO_BUSINESS_ID);
    expect(listed.some((employee) => employee.id === created.id)).toBe(true);

    const updated = await mockCoreRepository.updateEmployee(DEMO_BUSINESS_ID, created.id, { fullName: "Updated Person", role: "admin" });
    expect(updated.fullName).toBe("Updated Person");
    expect(updated.role).toBe("admin");

    await mockCoreRepository.deleteEmployee(DEMO_BUSINESS_ID, created.id);
    const afterDelete = await mockCoreRepository.listEmployees(DEMO_BUSINESS_ID);
    expect(afterDelete.some((employee) => employee.id === created.id)).toBe(false);
  });

  it("resolves the current employee for the seeded demo owner", async () => {
    const employee = await mockCoreRepository.getCurrentEmployee(DEMO_BUSINESS_ID, DEMO_OWNER_USER_ID);
    expect(employee).not.toBeNull();
    expect(employee?.role).toBe("owner");
  });
});

describe("mockCoreRepository — payment records", () => {
  it("excludes voided records by default and includes them when requested", async () => {
    mockDb.paymentRecords.push({
      id: "test-payment-1",
      businessId: DEMO_BUSINESS_ID,
      sourceModule: "pos",
      method: "cash",
      referenceCode: null,
      amount: "42.00",
      createdAt: new Date(),
      voidedAt: null,
    });

    const beforeVoid = await mockCoreRepository.listPaymentRecords(DEMO_BUSINESS_ID);
    expect(beforeVoid.some((record) => record.id === "test-payment-1")).toBe(true);

    await mockCoreRepository.voidPaymentRecord(DEMO_BUSINESS_ID, "test-payment-1");

    const afterVoidDefault = await mockCoreRepository.listPaymentRecords(DEMO_BUSINESS_ID);
    expect(afterVoidDefault.some((record) => record.id === "test-payment-1")).toBe(false);

    const afterVoidIncluded = await mockCoreRepository.listPaymentRecords(DEMO_BUSINESS_ID, { includeVoided: true });
    const voided = afterVoidIncluded.find((record) => record.id === "test-payment-1");
    expect(voided?.voidedAt).not.toBeNull();
  });

  it("excludes voided records from dashboard stats", async () => {
    const statsBefore = await mockCoreRepository.getDashboardStats(DEMO_BUSINESS_ID);

    mockDb.paymentRecords.push({
      id: "test-payment-2",
      businessId: DEMO_BUSINESS_ID,
      sourceModule: "pos",
      method: "cash",
      referenceCode: null,
      amount: "1000.00",
      createdAt: new Date(),
      voidedAt: null,
    });
    const statsAfterActive = await mockCoreRepository.getDashboardStats(DEMO_BUSINESS_ID);
    expect(statsAfterActive.todaySalesTotal).toBe(statsBefore.todaySalesTotal + 1000);

    await mockCoreRepository.voidPaymentRecord(DEMO_BUSINESS_ID, "test-payment-2");
    const statsAfterVoid = await mockCoreRepository.getDashboardStats(DEMO_BUSINESS_ID);
    expect(statsAfterVoid.todaySalesTotal).toBe(statsBefore.todaySalesTotal);
  });
});
