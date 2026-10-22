import { beforeAll, describe, expect, it } from "vitest";
import { LAST_OWNER_MESSAGE } from "../src/lib/repositories/repository";
import { getContext, repos, tag, type TestContext } from "./harness";

let ctx: TestContext;
let r: ReturnType<typeof repos>;

beforeAll(async () => {
  ctx = await getContext();
  r = repos(ctx.owner.client);
});

describe("employees", () => {
  it("adds, edits and removes an employee, and protects the last owner", async () => {
    const made = await r.core.createEmployee(ctx.businessId, { fullName: tag("Helper"), role: "staff" });
    expect(made.role).toBe("staff");
    expect((await r.core.updateEmployee(ctx.businessId, made.id, { fullName: made.fullName, role: "admin" })).role).toBe("admin");
    await r.core.deleteEmployee(ctx.businessId, made.id);
    expect((await r.core.listEmployees(ctx.businessId)).some((row) => row.id === made.id)).toBe(false);
    await expect(r.core.updateEmployee(ctx.businessId, ctx.ownerEmployeeId, { fullName: "E2E Owner", role: "staff" })).rejects.toThrow(LAST_OWNER_MESSAGE);
    await expect(r.core.deleteEmployee(ctx.businessId, ctx.ownerEmployeeId)).rejects.toThrow(LAST_OWNER_MESSAGE);
  });

  it("resolves membership for the signed-in user", async () => {
    expect((await r.core.getMembership(ctx.owner.userId))?.business.id).toBe(ctx.businessId);
    expect((await r.core.getCurrentEmployee(ctx.businessId, ctx.owner.userId))?.role).toBe("owner");
  });
});

describe("business setup", () => {
  it("saves receipt details and the setup wizard keeps required modules on", async () => {
    const saved = await r.core.saveReceiptDetails(ctx.businessId, { address: "1 Test St", tin: "123456789", contactNumber: "0917", receiptFooter: "Thanks" });
    expect(saved.id).toBe(ctx.businessId);
    expect(saved.tin).toBe("123-456-789");
    const modules = await r.core.listEnabledModules(ctx.businessId);
    const again = await r.core.saveBusinessSetup(ctx.businessId, { name: "E2E Test Business", enabledModules: modules });
    expect(again.name).toBe("E2E Test Business");
    expect(await r.core.listEnabledModules(ctx.businessId)).toEqual(expect.arrayContaining(modules));
    await expect(r.core.saveBusinessSetup(ctx.businessId, { name: "   ", enabledModules: modules })).rejects.toThrow();
  });
});

describe("audit log", () => {
  it("records who did what, and the log cannot be edited or deleted from the app", async () => {
    const made = await r.expenses.createExpense(ctx.businessId, { category: "other", description: tag("Audit"), amount: 1, expenseDate: new Date().toISOString().slice(0, 10), method: "cash", notes: null, recordedBy: null });
    await r.expenses.voidExpense(ctx.businessId, made.id);
    const log = await r.core.listAuditLog(ctx.businessId, { limit: 50 });
    expect(log.some((entry) => entry.entityId === made.id)).toBe(true);
    const row = log.find((entry) => entry.entityId === made.id)!;
    const { data: updated } = await ctx.owner.client.from("audit_log").update({ summary: "tampered" }).eq("id", row.id).select();
    const { data: removed } = await ctx.owner.client.from("audit_log").delete().eq("id", row.id).select();
    expect(updated ?? []).toHaveLength(0);
    expect(removed ?? []).toHaveLength(0);
  });
});

describe("security", () => {
  it("shows a signed-out visitor nothing", async () => {
    for (const table of ["businesses", "offerings", "payment_records", "expenses", "bookings", "employees", "audit_log"]) {
      const { data } = await ctx.anon.from(table).select("*").limit(5);
      expect(data ?? [], table).toHaveLength(0);
    }
    await expect(repos(ctx.anon).pos.checkout({ businessId: ctx.businessId, employeeId: ctx.ownerEmployeeId, lines: [], method: "cash" })).rejects.toThrow();
  });

  it("keeps another business's user out (tenant isolation)", async () => {
    if (!ctx.outsider) return;
    const out = repos(ctx.outsider.client);
    expect(await out.core.listEmployees(ctx.businessId)).toHaveLength(0);
    expect(await out.core.listPaymentRecords(ctx.businessId)).toHaveLength(0);
    expect(await out.expenses.listExpenses(ctx.businessId)).toHaveLength(0);
    await expect(out.expenses.createExpense(ctx.businessId, { category: "other", description: "x", amount: 1, expenseDate: new Date().toISOString().slice(0, 10), method: "cash", notes: null, recordedBy: null })).rejects.toThrow();
    await expect(out.core.createEmployee(ctx.businessId, { fullName: "Intruder", role: "owner" })).rejects.toThrow();
  });

  it("limits staff: they can sell but cannot manage people, setup, or void money", async () => {
    if (!ctx.staff) return;
    const s = repos(ctx.staff.client);
    await expect(s.core.createEmployee(ctx.businessId, { fullName: tag("Nope"), role: "owner" })).rejects.toThrow();
    await expect(s.core.saveBusinessSetup(ctx.businessId, { name: "Hacked", enabledModules: [] })).rejects.toThrow();
    const records = await r.core.listPaymentRecords(ctx.businessId);
    const first = records[0];
    if (first) {
      await expect(s.core.voidPaymentRecord(ctx.businessId, first.id)).rejects.toThrow(); // RLS blocks it, the repository now says so, and it stays un-voided
      expect((await r.core.listPaymentRecords(ctx.businessId)).some((row) => row.id === first.id)).toBe(true);
    }
    expect((await r.core.getBusiness(ctx.businessId)).name).toBe("E2E Test Business");
  });
});
