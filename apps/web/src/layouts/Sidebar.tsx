import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Store, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { cn } from "@isnabero/ui";
import { getModuleDefinition } from "@/lib/module-registry";
import { NAV_GROUPS, type NavEntry } from "@/lib/nav-config";
import { useBusinessModules } from "@/hooks/use-business-modules";
import { useBusinessStore } from "@/stores/business-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useCan } from "@/hooks/use-permission";
import { useT } from "@/i18n";

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

  // resolveEntry: a page/module entry -> label, path and icon, or null when it's hidden for this business or role
  const resolveEntry = (entry: NavEntry) => {
    if (entry.type === "page") {
      if (entry.permission && !can(entry.permission)) return null;
      if (entry.requiresModule && !enabledModules.includes(entry.requiresModule)) return null;
      return { key: entry.path, label: t(entry.labelKey), path: entry.path, icon: entry.icon };
    }
    const module = getModuleDefinition(entry.moduleKey);
    if (!module || !enabledModules.includes(module.key) || (module.permission && !can(module.permission))) return null;
    return { key: module.path, label: t(`modules.${module.key}.label`), path: module.path, icon: module.icon };
  };
  const groups = NAV_GROUPS.map((group) => ({ ...group, items: group.entries.map(resolveEntry).filter((item) => item !== null) })).filter((group) => group.items.length > 0);

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
          "flex flex-col border-r border-white/10 bg-sidebar text-sidebar-foreground transition-[transform,width] duration-200",
          // Mobile: fixed off-canvas drawer, slides in/out
          "fixed inset-y-0 left-0 z-50 w-72",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: back in normal flow, always visible, width driven by `collapsed`
          "md:static md:z-auto md:h-full md:shrink-0 md:translate-x-0",
          effectiveCollapsed ? "md:w-16" : "md:w-64",
        )}
      >
        {/* h-16 matches the TopBar so the two header rows (and their bottom lines) line up across the screen */}
        <div className={cn("flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4", effectiveCollapsed && "justify-center px-2")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-card">
            <Store className="h-4 w-4" />
          </div>
          {!effectiveCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase leading-none tracking-wide text-sidebar-muted">Isnabero</p>
              <p className="mt-1 truncate font-display text-sm font-semibold leading-none">{businessName ?? t("nav.selectBusiness")}</p>
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

        <nav className={cn("no-scrollbar flex-1 space-y-5 overflow-y-auto p-3", effectiveCollapsed && "px-2")} aria-label={t("nav.mainNavigation")}>
          {groups.map((group) => (
            <div key={group.id} className="space-y-1">
              {group.labelKey && !effectiveCollapsed && (
                <p className="px-3 text-xs font-semibold uppercase tracking-wide text-sidebar-muted">{t(group.labelKey)}</p>
              )}
              {group.labelKey && effectiveCollapsed && <div className="mx-2 border-t border-sidebar-border" aria-hidden="true" />}
              {group.items.map((item) => (
                <NavItem key={item.key} label={item.label} path={item.path} icon={item.icon} collapsed={effectiveCollapsed} onNavigate={() => setMobileOpen(false)} />
              ))}
            </div>
          ))}
        </nav>

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
