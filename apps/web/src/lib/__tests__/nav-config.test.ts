import { describe, it, expect } from "vitest";
import { MODULE_REGISTRY } from "../module-registry";
import { NAV_GROUPS } from "../nav-config";

const entries = NAV_GROUPS.flatMap((group) => group.entries);

describe("NAV_GROUPS", () => {
  it("lists every registered module exactly once", () => {
    const keys = entries.flatMap((entry) => (entry.type === "module" ? [entry.moduleKey] : []));
    expect([...keys].sort()).toEqual(MODULE_REGISTRY.map((module) => module.key).sort());
  });

  it("has unique page paths, all under /app", () => {
    const paths = entries.flatMap((entry) => (entry.type === "page" ? [entry.path] : []));
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path.startsWith("/app")).toBe(true);
  });

  it("gives every group except the first a heading", () => {
    for (const group of NAV_GROUPS.slice(1)) expect(group.labelKey).toBeDefined();
  });
});
