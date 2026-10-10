import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getDataSource, setAuditActor, DEMO_OWNER_USER_ID, DEMO_ADMIN_USER_ID, DEMO_STAFF_USER_ID } from "@isnabero/db";
import { supabase } from "@/lib/supabase";
import { getCoreRepository } from "@/lib/repositories/get-repository";
import type { EmployeeView } from "@/lib/repositories/repository";
import { useBusinessStore } from "@/stores/business-store";

interface AuthUser {
  id: string;
  email?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  employee: EmployeeView | null;
  loading: boolean; // auth session still resolving
  employeeLoading: boolean; // employee row (role) still resolving for the current user + business
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// MOCK_SESSIONS: who the mock-mode session acts as; pick with VITE_MOCK_ROLE (default owner) to try role-gated UI locally
const MOCK_SESSIONS = {
  owner: { id: DEMO_OWNER_USER_ID, email: "owner@sample-business.test" },
  admin: { id: DEMO_ADMIN_USER_ID, email: "admin@sample-business.test" },
  staff: { id: DEMO_STAFF_USER_ID, email: "staff@sample-business.test" },
} as const;

function getMockSession(): AuthUser {
  const role = import.meta.env.VITE_MOCK_ROLE;
  return role === "admin" || role === "staff" ? MOCK_SESSIONS[role] : MOCK_SESSIONS.owner;
}

// AuthProvider: the single source of truth for "who is logged in" and "what's their role for this
// business". In mock mode (default while building the frontend) it synthesizes a session for the
// seeded demo owner so the whole app works without a real Supabase project. In supabase mode it wires
// up real supabase.auth — see LoginPage for the sign-in flow and ProtectedRoute for the route guard.
export function AuthProvider({ children }: { children: ReactNode }) {
  const businessId = useBusinessStore((state) => state.businessId);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [employee, setEmployee] = useState<EmployeeView | null>(null);
  const [loading, setLoading] = useState(true);
  // resolvedKey: which user+business the current `employee` value belongs to — employeeLoading is derived from it
  // (not a separate flag) so there's no render where a signed-in user briefly looks like "no role"
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const employeeKey = user && businessId ? `${businessId}:${user.id}` : null;
  const employeeLoading = employeeKey !== null && resolvedKey !== employeeKey;

  useEffect(() => {
    if (getDataSource() === "mock") {
      // No real backend to check — "logged in" as a seeded demo employee (owner unless VITE_MOCK_ROLE says otherwise).
      setUser(getMockSession());
      setLoading(false);
      return;
    }

    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setUser(data.session?.user ? { id: data.session.user.id, email: data.session.user.email } : null);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || !businessId) {
      setEmployee(null);
      setResolvedKey(null);
      setAuditActor(null);
      return;
    }
    let isCurrent = true; // ignore a stale response if user/business changed mid-request
    const key = `${businessId}:${user.id}`;
    const settle = (value: EmployeeView | null) => {
      if (!isCurrent) return;
      setEmployee(value);
      setResolvedKey(key);
      setAuditActor(value ? { id: value.id, name: value.fullName } : null); // mock-mode audit rows; Supabase triggers use auth.uid()
    };
    getCoreRepository(supabase).getCurrentEmployee(businessId, user.id).then(settle).catch(() => settle(null));
    return () => {
      isCurrent = false;
    };
  }, [user, businessId]);

  const signOut = async () => {
    if (getDataSource() === "supabase") {
      await supabase.auth.signOut();
    }
    // Mock mode: nothing to sign out of — there's no real session to clear.
  };

  return (
    <AuthContext.Provider value={{ user, employee, loading, employeeLoading, isAuthenticated: Boolean(user), signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
