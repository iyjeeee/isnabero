import { afterEach, describe, expect, it } from "vitest";
import { DEMO_BUSINESS_ID, setAuditActor } from "@isnabero/db";
import { mockCoreRepository } from "../mock-repository";

const OTHER_BUSINESS_ID = "00000000-0000-0000-0000-00000000ffff";

async function entriesFor(entityId: string) {
  return (await mockCoreRepository.listAuditLog(DEMO_BUSINESS_ID)).filter((entry) => entry.entityId === entityId);
}

afterEach(() => setAuditActor(null));

describe("audit log (mock mode)", () => {
  it("logs employee changes only when something changed", async () => {
    const created = await mockCoreRepository.createEmployee(DEMO_BUSINESS_ID, { fullName: "Audit Person", role: "staff" });
    await mockCoreRepository.updateEmployee(DEMO_BUSINESS_ID, created.id, { fullName: "Audit Person", role: "staff" }); // no change
    await mockCoreRepository.updateEmployee(DEMO_BUSINESS_ID, created.id, { fullName: "Audit Person", role: "admin" });
    await mockCoreRepository.deleteEmployee(DEMO_BUSINESS_ID, created.id);
    const actions = (await entriesFor(created.id)).reverse().map((entry) => entry.action);
    expect(actions).toEqual(["employee.created", "employee.updated", "employee.deleted"]);
    expect((await entriesFor(created.id)).find((entry) => entry.action === "employee.updated")?.summary).toBe("Updated Audit Person: role staff → admin");
  });

  it("logs business renames and module changes", async () => {
    const business = await mockCoreRepository.getBusiness(DEMO_BUSINESS_ID);
    const modules = await mockCoreRepository.listEnabledModules(DEMO_BUSINESS_ID);
    const before = (await entriesFor(DEMO_BUSINESS_ID)).length;
    await mockCoreRepository.saveBusinessSetup(DEMO_BUSINESS_ID, { name: "Audit Rename", enabledModules: modules.filter((key) => key !== "expenses") });
    const added = (await entriesFor(DEMO_BUSINESS_ID)).slice(0, (await entriesFor(DEMO_BUSINESS_ID)).length - before).map((entry) => entry.action).sort();
    expect(added).toEqual(["business.modules_changed", "business.updated"]);
    // restore, so later tests see the original demo state
    await mockCoreRepository.saveBusinessSetup(DEMO_BUSINESS_ID, { name: business.name, enabledModules: modules });
  });

  it("is scoped to the business and newest first", async () => {
    expect(await mockCoreRepository.listAuditLog(OTHER_BUSINESS_ID)).toEqual([]);
    const entries = await mockCoreRepository.listAuditLog(DEMO_BUSINESS_ID);
    for (let i = 1; i < entries.length; i++) expect(entries[i - 1]!.createdAt.getTime() >= entries[i]!.createdAt.getTime()).toBe(true);
    expect((await mockCoreRepository.listAuditLog(DEMO_BUSINESS_ID, { limit: 2 })).length).toBeLessThanOrEqual(2);
  });
});
