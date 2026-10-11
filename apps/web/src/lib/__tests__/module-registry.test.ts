import { describe, it, expect } from "vitest";
import { moduleKeyEnum } from "@isnabero/db";
import { MODULE_REGISTRY, dependentsOf, getModuleDefinition, normalizeModules } from "../module-registry";
import { PERMISSIONS } from "../permissions";

describe("MODULE_REGISTRY", () => {
  it("only registers keys that exist in the database moduleKeyEnum (keeps the two lists in sync)", () => {
    for (const module of MODULE_REGISTRY) expect(moduleKeyEnum.enumValues).toContain(module.key);
  });

  it("has unique keys and paths, every path under /app", () => {
    expect(new Set(MODULE_REGISTRY.map((m) => m.key)).size).toBe(MODULE_REGISTRY.length);
    expect(new Set(MODULE_REGISTRY.map((m) => m.path)).size).toBe(MODULE_REGISTRY.length);
    for (const module of MODULE_REGISTRY) expect(module.path.startsWith("/app/")).toBe(true);
  });

  it("only references registered modules in `requires` and real permissions in `permission`", () => {
    for (const module of MODULE_REGISTRY) {
      for (const required of module.requires ?? []) expect(getModuleDefinition(required)).toBeDefined();
      if (module.permission) expect(Object.keys(PERMISSIONS)).toContain(module.permission);
    }
  });
});

describe("normalizeModules", () => {
  it("adds required modules: POS or Booking pull in Catalog", () => {
    expect(normalizeModules(["pos"])).toEqual(["catalog", "pos"]);
    expect(normalizeModules(["booking"])).toEqual(["catalog", "booking"]);
    expect(normalizeModules(["inventory"])).toEqual(["catalog", "inventory"]);
    expect(normalizeModules(["scheduling"])).toEqual(["scheduling"]); // needs nothing else
  });

  it("dedupes, returns registry order, and drops keys that aren't registered", () => {
    expect(normalizeModules(["booking", "pos", "pos", "catalog"])).toEqual(["catalog", "pos", "booking"]);
    expect(normalizeModules(["online_store"])).toEqual([]);
  });

  it("returns an empty list for an empty selection", () => {
    expect(normalizeModules([])).toEqual([]);
  });
});

describe("dependentsOf", () => {
  it("lists the selected modules that need the given one", () => {
    expect(dependentsOf("catalog", ["catalog", "pos"]).map((m) => m.key)).toEqual(["pos"]);
    expect(dependentsOf("catalog", ["catalog", "pos", "booking"]).map((m) => m.key)).toEqual(["pos", "booking"]);
  });

  it("is empty when nothing selected needs it", () => {
    expect(dependentsOf("catalog", ["catalog"])).toEqual([]);
    expect(dependentsOf("pos", ["catalog", "pos"])).toEqual([]);
  });
});
