import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DUPLICATE_BARCODE_MESSAGE, OfferingInUseError } from "../../../packages/modules/catalog/src/rules";
import { getContext, repos, tag, type TestContext } from "./harness";

let ctx: TestContext;
let catalog: ReturnType<typeof repos>["catalog"];
const created: string[] = [];
const item = (name: string, barcode: string | null = null) => ({ offering: { name, description: "integration test", type: "item" as const, price: "25.50", durationMinutes: null, isAvailable: true, barcode }, inclusions: [] });

beforeAll(async () => {
  ctx = await getContext();
  catalog = repos(ctx.owner.client).catalog;
});

afterAll(async () => {
  for (const id of created) await catalog.deleteOffering(ctx.businessId, id).catch(() => undefined); // offerings that were sold stay (marked sold out) — they carry the [E2E] tag
});

describe("catalog", () => {
  it("creates an item with a barcode and lists it", async () => {
    const code = `E2E-${Date.now()}`;
    const made = await catalog.createOfferingWithInclusions(ctx.businessId, item(tag("Item"), code));
    created.push(made.id);
    expect(made.barcode).toBe(code);
    expect(Number(made.price)).toBe(25.5);
    expect((await catalog.listOfferings(ctx.businessId)).some((offering) => offering.id === made.id)).toBe(true);
  });

  it("refuses a repeated barcode in any letter case, and allows keeping your own", async () => {
    const code = `E2E-DUP-${Date.now()}`;
    const first = await catalog.createOfferingWithInclusions(ctx.businessId, item(tag("A"), code));
    created.push(first.id);
    await expect(catalog.createOfferingWithInclusions(ctx.businessId, item(tag("B"), code.toLowerCase()))).rejects.toThrow(DUPLICATE_BARCODE_MESSAGE);
    const same = await catalog.updateOffering(ctx.businessId, first.id, item(tag("A2"), code));
    expect(same.barcode).toBe(code);
    const cleared = await catalog.updateOffering(ctx.businessId, first.id, item(tag("A3"), null));
    expect(cleared.barcode).toBeNull();
  });

  it("saves bundle inclusions, replaces them on edit, and toggles availability", async () => {
    const bundle = await catalog.createOfferingWithInclusions(ctx.businessId, {
      offering: { name: tag("Bundle"), description: null, type: "bundle", price: "300.00", durationMinutes: 30, isAvailable: true, barcode: null },
      inclusions: [{ label: "Prints", quantity: 4 }, { label: "Unli shots", quantity: null }],
    });
    created.push(bundle.id);
    expect(bundle.inclusions).toHaveLength(2);
    const edited = await catalog.updateOffering(ctx.businessId, bundle.id, {
      offering: { name: bundle.name, description: null, type: "bundle", price: "350.00", durationMinutes: 30, isAvailable: true, barcode: null },
      inclusions: [{ label: "Prints", quantity: 6 }],
    });
    expect(edited.inclusions.map((row) => [row.label, row.quantity])).toEqual([["Prints", 6]]);
    await catalog.toggleAvailability(bundle.id, false);
    expect((await catalog.listOfferings(ctx.businessId)).find((offering) => offering.id === bundle.id)?.isAvailable).toBe(false);
  });

  it("deletes an unused offering and blocks deleting one that was sold", async () => {
    const unused = await catalog.createOfferingWithInclusions(ctx.businessId, item(tag("Unused")));
    await catalog.deleteOffering(ctx.businessId, unused.id);
    expect((await catalog.listOfferings(ctx.businessId)).some((offering) => offering.id === unused.id)).toBe(false);

    const sold = await catalog.createOfferingWithInclusions(ctx.businessId, item(tag("Sold")));
    created.push(sold.id);
    await repos(ctx.owner.client).pos.checkout({ businessId: ctx.businessId, employeeId: ctx.ownerEmployeeId, lines: [{ offering: sold, quantity: 1 }], method: "cash" });
    await expect(catalog.deleteOffering(ctx.businessId, sold.id)).rejects.toBeInstanceOf(OfferingInUseError);
  });
});
