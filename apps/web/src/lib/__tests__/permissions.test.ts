import { describe, it, expect } from "vitest";
import { PERMISSIONS, hasPermission, type Permission } from "../permissions";

const ALL = Object.keys(PERMISSIONS) as Permission[];

describe("hasPermission", () => {
  it("owner has every permission", () => {
    for (const permission of ALL) expect(hasPermission("owner", permission)).toBe(true);
  });

  it("admin has the same permissions as the owner, including configuring the business", () => {
    for (const permission of ALL) expect(hasPermission("admin", permission), permission).toBe(true);
  });

  it("staff has none of the gated permissions (everything gated is owner/admin)", () => {
    for (const permission of ALL) expect(hasPermission("staff", permission)).toBe(false);
  });

  it("denies a missing or unknown role", () => {
    for (const permission of ALL) {
      expect(hasPermission(null, permission)).toBe(false);
      expect(hasPermission(undefined, permission)).toBe(false);
      expect(hasPermission("", permission)).toBe(false);
      expect(hasPermission("superuser", permission)).toBe(false);
    }
  });

  it("only references the three known roles", () => {
    const roles = new Set(Object.values(PERMISSIONS).flat());
    expect([...roles].every((role) => role === "owner" || role === "admin" || role === "staff")).toBe(true);
  });
});
