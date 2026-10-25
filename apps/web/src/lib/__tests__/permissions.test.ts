import { describe, it, expect } from "vitest";
import { PERMISSIONS, assignableRoles, canManageEmployee, hasPermission, type Permission } from "../permissions";

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

describe("owner role protection", () => {
  it("only an owner can hand out the owner role", () => {
    expect(assignableRoles("owner")).toEqual(["staff", "admin", "owner"]);
    expect(assignableRoles("admin")).toEqual(["staff", "admin"]);
    expect(assignableRoles("staff")).toEqual([]);
    expect(assignableRoles(null)).toEqual([]);
  });

  it("an admin can manage admins and staff but not owners; an owner can manage everyone", () => {
    expect(canManageEmployee("admin", "staff")).toBe(true);
    expect(canManageEmployee("admin", "admin")).toBe(true);
    expect(canManageEmployee("admin", "owner")).toBe(false);
    expect(canManageEmployee("owner", "owner")).toBe(true);
    expect(canManageEmployee("staff", "staff")).toBe(false);
    expect(canManageEmployee(undefined, "staff")).toBe(false);
  });
});

