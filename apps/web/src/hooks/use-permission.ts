import { useAuth } from "@/providers/AuthProvider";
import { hasPermission, type Permission } from "@/lib/permissions";

// useCan: returns a checker for the current employee's role. Everything is denied while auth/employee
// data is still loading, so gated UI stays hidden rather than flashing then disappearing.
export function useCan(): (permission: Permission) => boolean {
  const { employee, loading, employeeLoading } = useAuth();
  const role = loading || employeeLoading ? null : employee?.role;
  return (permission) => hasPermission(role, permission);
}

// usePermission: single-permission shorthand for useCan
export function usePermission(permission: Permission): boolean {
  return useCan()(permission);
}
