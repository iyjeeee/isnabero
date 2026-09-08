import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getDataSource, DEMO_OWNER_USER_ID } from "@isnabero/db";
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
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// AuthProvider: the single source of truth for "who is logged in" and "what's their role for this
// business". In mock mode (default while building the frontend) it synthesizes a session for the
// seeded demo owner so the whole app works without a real Supabase project. In supabase mode it wires
// up real supabase.auth — see LoginPage for the sign-in flow and ProtectedRoute for the route guard.
export function AuthProvider({ children }: { children: ReactNode }) {
  const businessId = useBusinessStore((state) => state.businessId);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [employee, setEmployee] = useState<EmployeeView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (getDataSource() === "mock") {
      // No real backend to check — always "logged in" as the seeded demo owner.
      setUser({ id: DEMO_OWNER_USER_ID, email: "owner@sample-business.test" });
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
      return;
    }
    const repository = getCoreRepository(supabase);
    repository.getCurrentEmployee(businessId, user.id).then(setEmployee).catch(() => setEmployee(null));
  }, [user, businessId]);

  const signOut = async () => {
    if (getDataSource() === "supabase") {
      await supabase.auth.signOut();
    }
    // Mock mode: nothing to sign out of — there's no real session to clear.
  };

  return (
    <AuthContext.Provider value={{ user, employee, loading, isAuthenticated: Boolean(user), signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
