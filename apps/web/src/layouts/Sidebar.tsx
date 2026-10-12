import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Wallet, Users, BarChart3, Settings, ScrollText, Store, ChevronsLeft, ChevronsRight, LogOut, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@isnabero/ui";
import { getDataSource } from "@isnabero/db";
import { MODULE_REGISTRY } from "@/lib/module-registry";
import { useBusinessModules } from "@/hooks/use-business-modules";
import { useBusinessStore } from "@/stores/business-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useAuth } from "@/providers/AuthProvider";
import { useCan } from "@/hooks/use-permission";
import type { Permission } from "@/lib/permissions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useT, type TranslationKey } from "@/i18n";

// CORE_NAV: never toggleable — every business gets these regardless of which modules are active.
// `permission` hides an entry from roles that lack it (see lib/permissions.ts).
const CORE_NAV: Array<{ labelKey: TranslationKey; path: string; icon: React.ComponentType<{ className?: string }>; permission?: Permission }> = [
  { labelKey: "nav.dashboard", path: "/app", icon: LayoutDashboard },
  { labelKey: "nav.payments", path: "/app/payments", icon: Wallet },
  { labelKey: "nav.employees", path: "/app/employees", icon: Users },
  { labelKey: "nav.reports", path: "/app/reports", icon: BarChart3 },
  { labelKey: "nav.audit", path: "/app/audit", icon: ScrollText, permission: "audit.view" },
  { labelKey: "nav.setup", path: "/app/setup", icon: Settings, permission: "business.configure" },
];

function NavItem({
  label,
  path,
  icon: Icon,
  collapsed,
  onNavigate,
}: {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  return (
    <NavLink
      to={path}
      end={path === "/app"}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-primary text-primary-foreground shadow-card"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
          !collapsed && !isActive && "hover:translate-x-0.5",
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110" />
      {!collapsed && label}
    </NavLink>
  );
}

export function Sidebar() {
  const businessId = useBusinessStore((state) => state.businessId);
  const businessName = useBusinessStore((state) => state.businessName);
  const { data: enabledModules = [] } = useBusinessModules(businessId);
  const collapsed = useSidebarStore((state) => state.collapsed);
  const toggleCollapsed = useSidebarStore((state) => state.toggleCollapsed);
  const mobileOpen = useSidebarStore((state) => state.mobileOpen);
  const setMobileOpen = useSidebarStore((state) => state.setMobileOpen);
  const { signOut } = useAuth();
  const { t } = useT();
  const can = useCan();
  const location = useLocation();

  // Desktop = persistent, collapsible panel. Mobile = off-canvas drawer, either fully open or fully
  // closed — "collapsed" (icon-only) is a desktop-only concept, so it's ignored entirely on mobile even
  // if the preference is persisted from a previous desktop session.
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const effectiveCollapsed = collapsed && isDesktop;

  // Auto-close the mobile drawer on every navigation — standard drawer UX, otherwise it stays open
  // covering the page after tapping a link.
  useEffect(() => {
    setMobileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const handleSignOut = async () => {
    if (getDataSource() !== "supabase") {
      toast.info(t("nav.signOutMock"));
      return;
    }
    await signOut();
  };

  // Only show modules that are registered in code, toggled on for this business, AND allowed for the current role
  const activeModules = MODULE_REGISTRY.filter((module) => enabledModules.includes(module.key) && (!module.permission || can(module.permission)));
  const visibleCoreNav = CORE_NAV.filter((item) => !item.permission || can(item.permission));

  return (
    <>
      {/* Backdrop — mobile only, closes the drawer on tap. Always in the DOM (simpler than conditional
          mounting) but invisible/non-interactive unless the drawer is open, and never shown on desktop. */}
      <div
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "flex flex-col bg-sidebar text-sidebar-foreground transition-[transform,width] duration-200",
          // Mobile: fixed off-canvas drawer, slides in/out
          "fixed inset-y-0 left-0 z-50 w-72",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: back in normal flow, always visible, width driven by `collapsed`
          "md:static md:z-auto md:h-full md:shrink-0 md:translate-x-0",
          effectiveCollapsed ? "md:w-16" : "md:w-64",
        )}
      >
        <div className={cn("flex items-center gap-3 border-b border-sidebar-border px-4 py-5", effectiveCollapsed && "justify-center px-2")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-card">
            <Store className="h-4 w-4" />
          </div>
          {!effectiveCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-sidebar-muted">Isnabero</p>
              <p className="truncate font-display text-sm font-semibold">{businessName ?? t("nav.selectBusiness")}</p>
            </div>
          )}
          {/* Close button — mobile drawer only */}
          <button
            onClick={() => setMobileOpen(false)}
            aria-label={t("nav.closeMenu")}
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className={cn("flex-1 space-y-6 overflow-y-auto p-3", effectiveCollapsed && "px-2")}>
          <div className="space-y-1">
            {!effectiveCollapsed && <p className="px-3 text-xs font-semibold uppercase tracking-wide text-sidebar-muted">{t("nav.core")}</p>}
            {visibleCoreNav.map((item) => (
              <NavItem key={item.path} label={t(item.labelKey)} path={item.path} icon={item.icon} collapsed={effectiveCollapsed} onNavigate={() => setMobileOpen(false)} />
            ))}
          </div>

          <div className="space-y-1">
            {!effectiveCollapsed && <p className="px-3 text-xs font-semibold uppercase tracking-wide text-sidebar-muted">{t("nav.modules")}</p>}
            {!effectiveCollapsed && activeModules.length === 0 && (
              <p className="px-3 text-sm text-sidebar-muted">{t("nav.noModules")}</p>
            )}
            {activeModules.map((item) => (
              <NavItem
                key={item.path}
                label={t(`modules.${item.key}.label`)}
                path={item.path}
                icon={item.icon}
                collapsed={effectiveCollapsed}
                onNavigate={() => setMobileOpen(false)}
              />
            ))}
          </div>
        </nav>

        <div className={cn("flex items-center border-t border-sidebar-border px-4 py-3", effectiveCollapsed ? "flex-col gap-2 px-2" : "justify-between")}>
          {!effectiveCollapsed && <span className="text-xs text-sidebar-muted">{t("nav.theme")}</span>}
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
            <button
              onClick={handleSignOut}
              title={t("nav.signOut")}
              aria-label={t("nav.signOut")}
              className="flex h-9 w-9 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Collapse toggle — desktop only; collapsing to icon-only doesn't apply to the mobile drawer */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
          className="hidden items-center justify-center gap-2 border-t border-sidebar-border py-2.5 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground md:flex"
        >
          {effectiveCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!effectiveCollapsed && <span className="text-xs font-medium">{t("nav.collapse")}</span>}
        </button>
      </aside>
    </>
  );
}
