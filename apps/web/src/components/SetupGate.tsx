import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/providers/AuthProvider";
import { useCan } from "@/hooks/use-permission";
import { useBusiness } from "@/hooks/use-business";
import { useBusinessStore } from "@/stores/business-store";
import { PageFallback } from "@/components/PageFallback";

// SetupGate: first-run redirect — an owner whose business hasn't finished the setup wizard lands on it instead of an
// empty dashboard. Other roles can't run setup, so they pass through; a failed business fetch never blocks the app.
export function SetupGate() {
  const businessId = useBusinessStore((state) => state.businessId);
  const { loading, employeeLoading } = useAuth();
  const { data: business, isLoading } = useBusiness(businessId);
  const canConfigure = useCan()("business.configure");

  if (loading || employeeLoading || isLoading) return <PageFallback />;
  if (business && business.setupCompletedAt === null && canConfigure) return <Navigate to="/app/setup" replace />;
  return <Outlet />;
}
