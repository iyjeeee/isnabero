import { NavLink } from "react-router-dom";
import { LayoutDashboard, Wallet, Users, BarChart3, Store, ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@isnabero/ui";
import { getDataSource } from "@isnabero/db";
import { MODULE_REGISTRY } from "@/lib/module-registry";
import { useBusinessModules } from "@/hooks/use-business-modules";
import { useBusinessStore } from "@/stores/business-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useAuth } from "@/providers/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

// CORE_NAV: never toggleable — every business gets these regardless of which modules are active
const CORE_NAV = [
  { label: "Dashboard", path: "/app", icon: LayoutDashboard },
  { label: "Payment Records", path: "/app/payments", icon: Wallet },
  { label: "Employees", path: "/app/employees", icon: Users },
  { label: "Reports", path: "/app/reports", icon: BarChart3 },
];

function NavItem({
  label,
  path,
  icon: Icon,
  collapsed,
}: {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={path}
      end={path === "/app"}
      title={collapsed ? label : undefined}
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
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    if (getDataSource() !== "supabase") {
      toast.info("Sign out is only meaningful in Supabase mode — mock mode has no real session.");
      return;
    }
    await signOut();
  };

  // Only show modules that are BOTH registered in code AND toggled on for this business
  const activeModules = MODULE_REGISTRY.filter((module) => enabledModules.includes(module.key));

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className={cn("flex items-center gap-3 border-b border-sidebar-border px-4 py-5", collapsed && "justify-center px-2")}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-card">
          <Store className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-sidebar-muted">Isnabero</p>
            <p className="truncate font-display text-sm font-semibold">{businessName ?? "Select a business"}</p>
          </div>
        )}
      </div>

      <nav className={cn("flex-1 space-y-6 overflow-y-auto p-3", collapsed && "px-2")}>
        <div className="space-y-1">
          {!collapsed && <p className="px-3 text-xs font-semibold uppercase tracking-wide text-sidebar-muted">Core</p>}
          {CORE_NAV.map((item) => (
            <NavItem key={item.path} {...item} collapsed={collapsed} />
          ))}
        </div>

        <div className="space-y-1">
          {!collapsed && <p className="px-3 text-xs font-semibold uppercase tracking-wide text-sidebar-muted">Modules</p>}
          {!collapsed && activeModules.length === 0 && (
            <p className="px-3 text-sm text-sidebar-muted">No modules enabled yet.</p>
          )}
          {activeModules.map((item) => (
            <NavItem key={item.path} label={item.label} path={item.path} icon={item.icon} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      <div className={cn("flex items-center border-t border-sidebar-border px-4 py-3", collapsed ? "flex-col gap-2 px-2" : "justify-between")}>
        {!collapsed && <span className="text-xs text-sidebar-muted">Theme</span>}
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      <button
        onClick={toggleCollapsed}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="flex items-center justify-center gap-2 border-t border-sidebar-border py-2.5 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        {!collapsed && <span className="text-xs font-medium">Collapse</span>}
      </button>
    </aside>
  );
}
