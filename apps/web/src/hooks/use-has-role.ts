import { useAuth } from "@/providers/AuthProvider";

// useHasRole: true if the current employee's role is one of the allowed roles. Returns false while
// auth/employee data is still loading, so gated UI stays hidden rather than flashing then disappearing.
export function useHasRole(allowedRoles: Array<"owner" | "admin" | "staff">): boolean {
  const { employee, loading } = useAuth();
  if (loading || !employee) return false;
  return allowedRoles.includes(employee.role as "owner" | "admin" | "staff");
}
