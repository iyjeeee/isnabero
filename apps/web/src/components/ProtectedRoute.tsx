import { Navigate, Outlet } from "react-router-dom";
import { useT } from "@/i18n";
import { useAuth } from "@/providers/AuthProvider";

export function ProtectedRoute() {
  const { t } = useT();
  const { isAuthenticated, loading } = useAuth();

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

  return <Outlet />;
}
