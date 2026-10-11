// RBAC: the single place that says which role can do what. UI gates (hooks, route guards, nav) read
// from here; the database enforces the same rules with RLS (see supabase/migrations/0004_*.sql).

export type Role = "owner" | "admin" | "staff";

// PERMISSIONS: permission -> roles allowed. Add a new capability here first, then gate with usePermission.
export const PERMISSIONS = {
  "business.configure": ["owner"], // setup wizard, business name, module toggles
  "employees.manage": ["owner", "admin"], // add / edit / remove employees
  "payments.void": ["owner", "admin"], // void a payment record
  "expenses.view": ["owner", "admin"], // see the Expenses page
  "expenses.manage": ["owner", "admin"], // record / void expenses
  "audit.view": ["owner", "admin"],
  "inventory.manage": ["owner", "admin"], // staff can see stock levels but not change them
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

// hasPermission: false for a missing or unknown role (e.g. employee row not resolved yet)
export function hasPermission(role: string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}
