import { describe, it, expect } from "vitest";
import { mockCoreRepository } from "../mock-repository";
import { mockDb, DEMO_BUSINESS_ID, DEMO_OWNER_USER_ID, auditRows } from "@isnabero/db";
import { formatTin, validateReceiptDetails } from "../repository";

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

describe("mockCoreRepository — last-owner protection", () => {
  it("refuses to delete or demote the only owner, but allows it once another owner exists", async () => {
    const employees = await mockCoreRepository.listEmployees(DEMO_BUSINESS_ID);
    const owners = employees.filter((employee) => employee.role === "owner");
    expect(owners).toHaveLength(1);
    const owner = owners[0]!;

    await expect(mockCoreRepository.deleteEmployee(DEMO_BUSINESS_ID, owner.id)).rejects.toThrow(/at least one owner/);
    await expect(
      mockCoreRepository.updateEmployee(DEMO_BUSINESS_ID, owner.id, { fullName: owner.fullName, role: "admin" }),
    ).rejects.toThrow(/at least one owner/);

    // a second owner unlocks demoting the first; restore the original state afterwards for other tests
    const second = await mockCoreRepository.createEmployee(DEMO_BUSINESS_ID, { fullName: "Second Owner", role: "owner" });
    await mockCoreRepository.updateEmployee(DEMO_BUSINESS_ID, owner.id, { fullName: owner.fullName, role: "admin" });
    await mockCoreRepository.updateEmployee(DEMO_BUSINESS_ID, owner.id, { fullName: owner.fullName, role: "owner" });
    await mockCoreRepository.deleteEmployee(DEMO_BUSINESS_ID, second.id);
  });
});

describe("mockCoreRepository — business setup", () => {
  const TEST_BUSINESS_ID = "test-business-setup";

  it("treats the seeded demo business as already set up", async () => {
    const business = await mockCoreRepository.getBusiness(DEMO_BUSINESS_ID);
    expect(business.setupCompletedAt).not.toBeNull();
  });

  it("rejects an unknown business", async () => {
    await expect(mockCoreRepository.getBusiness("nope")).rejects.toThrow(/not found/);
    await expect(mockCoreRepository.saveBusinessSetup("nope", { name: "X", enabledModules: [] })).rejects.toThrow(/not found/);
  });

  it("stamps setupCompletedAt on first save only, renames, and sets modules (adding what they need)", async () => {
    mockDb.businesses.push({ id: TEST_BUSINESS_ID, name: "Fresh Shop", slug: "fresh-shop", createdAt: new Date(), setupCompletedAt: null, address: null, tin: null, contactNumber: null, receiptFooter: null });
    try {
      expect((await mockCoreRepository.getBusiness(TEST_BUSINESS_ID)).setupCompletedAt).toBeNull();

      const first = await mockCoreRepository.saveBusinessSetup(TEST_BUSINESS_ID, { name: "  My Shop  ", enabledModules: ["pos"] });
      expect(first.name).toBe("My Shop");
      expect(first.setupCompletedAt).not.toBeNull();
      expect(await mockCoreRepository.listEnabledModules(TEST_BUSINESS_ID)).toEqual(["catalog", "pos"]);

      // re-run: turn POS off, Booking on — completion date is kept, modules are replaced (not appended)
      const second = await mockCoreRepository.saveBusinessSetup(TEST_BUSINESS_ID, { name: "My Shop", enabledModules: ["booking"] });
      expect(second.setupCompletedAt).toEqual(first.setupCompletedAt);
      expect((await mockCoreRepository.listEnabledModules(TEST_BUSINESS_ID)).sort()).toEqual(["booking", "catalog"]);
      expect(mockDb.businessModules.filter((row) => row.businessId === TEST_BUSINESS_ID && row.moduleKey === "pos")).toHaveLength(1);

      // turning everything off is allowed — the always-on core still works
      await mockCoreRepository.saveBusinessSetup(TEST_BUSINESS_ID, { name: "My Shop", enabledModules: [] });
      expect(await mockCoreRepository.listEnabledModules(TEST_BUSINESS_ID)).toEqual([]);
    } finally {
      mockDb.businesses.splice(mockDb.businesses.findIndex((b) => b.id === TEST_BUSINESS_ID), 1);
      mockDb.businessModules = mockDb.businessModules.filter((row) => row.businessId !== TEST_BUSINESS_ID);
    }
  });

  it("rejects a blank or too-long name without changing anything", async () => {
    const before = await mockCoreRepository.getBusiness(DEMO_BUSINESS_ID);
    const modulesBefore = await mockCoreRepository.listEnabledModules(DEMO_BUSINESS_ID);
    await expect(mockCoreRepository.saveBusinessSetup(DEMO_BUSINESS_ID, { name: "   ", enabledModules: [] })).rejects.toThrow(/required/);
    await expect(mockCoreRepository.saveBusinessSetup(DEMO_BUSINESS_ID, { name: "x".repeat(81), enabledModules: [] })).rejects.toThrow(/80/);
    expect((await mockCoreRepository.getBusiness(DEMO_BUSINESS_ID)).name).toBe(before.name);
    expect(await mockCoreRepository.listEnabledModules(DEMO_BUSINESS_ID)).toEqual(modulesBefore);
  });
});

describe("receipt details", () => {
  const blank = { address: "", tin: "", contactNumber: "", receiptFooter: "" };
  const original = () => {
    const business = mockDb.businesses.find((item) => item.id === DEMO_BUSINESS_ID);
    return { address: business?.address ?? "", tin: business?.tin ?? "", contactNumber: business?.contactNumber ?? "", receiptFooter: business?.receiptFooter ?? "" };
  };

  it("formats 9- and 12-digit TINs and rejects anything else", () => {
    expect(formatTin("123456789")).toBe("123-456-789");
    expect(formatTin("123 456 789 000")).toBe("123-456-789-000");
    expect(formatTin("123-456-789-0")).toBeNull();
    expect(formatTin("12A-456-789")).toBeNull();
  });

  it("turns blanks into null and reports field errors", () => {
    expect(validateReceiptDetails(blank).values).toEqual({ address: null, tin: null, contactNumber: null, receiptFooter: null });
    const { errors } = validateReceiptDetails({ address: "x".repeat(201), tin: "12", contactNumber: "call me", receiptFooter: "y".repeat(121) });
    expect(Object.keys(errors).sort()).toEqual(["address", "contactNumber", "receiptFooter", "tin"]);
  });

  it("saves details, normalises the TIN and logs one audit entry without the TIN", async () => {
    const before = original();
    const logged = auditRows.length;
    try {
      const saved = await mockCoreRepository.saveReceiptDetails(DEMO_BUSINESS_ID, { ...before, address: "  1 Test Ave  ", tin: "123456789012" });
      expect(saved).toMatchObject({ address: "1 Test Ave", tin: "123-456-789-012" });
      const entry = auditRows.find((row) => row.summary === "Receipt details updated");
      expect(entry?.action).toBe("business.updated");
      expect(entry?.summary).not.toMatch(/123/);
      // an unchanged save adds nothing
      const count = auditRows.length;
      await mockCoreRepository.saveReceiptDetails(DEMO_BUSINESS_ID, { ...before, address: "1 Test Ave", tin: "123-456-789-012" });
      expect(auditRows.length).toBe(count);
      expect(count).toBe(logged + 1);
    } finally {
      await mockCoreRepository.saveReceiptDetails(DEMO_BUSINESS_ID, before);
    }
  });

  it("rejects an invalid TIN without changing anything", async () => {
    const before = original();
    await expect(mockCoreRepository.saveReceiptDetails(DEMO_BUSINESS_ID, { ...before, tin: "nope" })).rejects.toThrow(/TIN/);
    expect(original()).toEqual(before);
  });
});
