import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PowerOff, ShieldAlert } from "lucide-react";
import { Button, EmptyState } from "@isnabero/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useCan } from "@/hooks/use-permission";
import { useBusinessModules } from "@/hooks/use-business-modules";
import { useBusinessStore } from "@/stores/business-store";
import { useSetupDialogStore } from "@/stores/setup-dialog-store";
import { useT } from "@/i18n";
import { PageFallback } from "@/components/PageFallback";
import { getModuleDefinition, type ModuleKey } from "@/lib/module-registry";
import type { Permission } from "@/lib/permissions";

interface RouteGuardProps {
  permission?: Permission; // role gate; for a module route it defaults to the module's own permission in MODULE_REGISTRY
  moduleKey?: ModuleKey; // the page also needs this module turned on for the business
  children: ReactNode;
}

// RouteGuard: wraps a route's page so a role without the permission (or a turned-off module) sees a clear state
// instead of the page — typing the URL directly can't bypass the hidden nav link. The database enforces the same
// rules via RLS.
export function RouteGuard({ permission, moduleKey, children }: RouteGuardProps) {
  const { t } = useT();
  const { loading, employeeLoading } = useAuth();
  const businessId = useBusinessStore((state) => state.businessId);
  const { data: enabledModules, isLoading: modulesLoading } = useBusinessModules(businessId);
  const can = useCan();
  const setSetupOpen = useSetupDialogStore((state) => state.setOpen);

  const definition = moduleKey ? getModuleDefinition(moduleKey) : undefined;
  const requiredPermission = permission ?? definition?.permission;

  if (loading || employeeLoading || (moduleKey && modulesLoading)) return <PageFallback />;

  // Permission first: someone without access shouldn't learn how the business is configured
  if (requiredPermission && !can(requiredPermission)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t("app.routeGuard.noAccessTitle")}
        description={t("app.routeGuard.noAccessHint")}
        action={
          <Button asChild variant="outline">
            <Link to="/app">{t("app.routeGuard.backToDashboard")}</Link>
          </Button>
        }
      />
    );
  }

  // If the module list failed to load, don't block the page on it (enabledModules undefined)
  if (moduleKey && enabledModules && !enabledModules.includes(moduleKey)) {
    return (
      <EmptyState
        icon={PowerOff}
        title={t("app.routeGuard.moduleOffTitle", { module: moduleKey ? t(`modules.${moduleKey}.label`) : t("app.routeGuard.thisModule") })}
        description={t("app.routeGuard.moduleOffHint")}
        action={
          can("business.configure") ? (
            <Button variant="outline" onClick={() => setSetupOpen(true)}>
              {t("app.routeGuard.openSetup")}
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link to="/app">{t("app.routeGuard.backToDashboard")}</Link>
            </Button>
          )
        }
      />
    );
  }

  return <>{children}</>;
}
