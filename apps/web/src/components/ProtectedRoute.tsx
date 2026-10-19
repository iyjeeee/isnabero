import { Navigate, Outlet } from "react-router-dom";
import { useT } from "@/i18n";
import { useAuth } from "@/providers/AuthProvider";
import { NoBusinessAccess } from "@/components/NoBusinessAccess";

export function ProtectedRoute() {
  const { t } = useT();
  const { isAuthenticated, loading, noBusiness } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (noBusiness) return <NoBusinessAccess />;

  return <Outlet />;
}
