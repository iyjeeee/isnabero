import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Wallet,
  CalendarClock,
  Users,
  ShoppingCart,
  LayoutGrid,
  ArrowRight,
  CheckCircle2,
  Circle,
  Receipt,
  Sparkles,
} from "lucide-react";
import { PageHeader, StatCard, Card, CardContent, CardHeader, CardTitle, Badge, EmptyState, cn } from "@isnabero/ui";
import { useOfferings } from "@isnabero/module-catalog";
import { supabase } from "@/lib/supabase";
import { useBusinessStore } from "@/stores/business-store";
import { useBusinessModules } from "@/hooks/use-business-modules";
import { useBusiness } from "@/hooks/use-business";
import { useCan } from "@/hooks/use-permission";
import { getModuleDefinition } from "@/lib/module-registry";
import type { Permission } from "@/lib/permissions";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { getCoreRepository } from "@/lib/repositories/get-repository";

// QUICK_ACTIONS: shortcuts to the most common next step per module — kept in sync manually with
// MODULE_REGISTRY since each action has bespoke copy, unlike the sidebar's generic nav entries.
// `tint` picks the same semantic accent family as StatCard so the tiles feel like one system.
// A module's own role gate (MODULE_REGISTRY permission) also hides its quick action from roles without access.
const QUICK_ACTIONS = [
  { label: "Ring up a sale", description: "Open the POS screen", path: "/app/pos", icon: ShoppingCart, moduleKey: "pos" as const, tint: "success" as const },
  { label: "Add to Catalog", description: "New item, bundle or add-on", path: "/app/catalog", icon: LayoutGrid, moduleKey: "catalog" as const, tint: "default" as const },
  { label: "New booking", description: "Schedule a customer", path: "/app/booking", icon: CalendarClock, moduleKey: "booking" as const, tint: "info" as const },
  { label: "Record an expense", description: "Rent, supplies, utilities…", path: "/app/expenses", icon: Receipt, moduleKey: "expenses" as const, tint: "warning" as const },
];

// SOURCE_MODULE_ICON: small icon per payment source so Recent Activity reads at a glance instead of
// relying on the capitalized label text alone.
const SOURCE_MODULE_ICON: Record<string, ComponentType<{ className?: string }>> = {
  pos: ShoppingCart,
  booking: CalendarClock,
};

const QUICK_ACTION_TINT: Record<string, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
};

export default function DashboardPage() {
  const businessId = useBusinessStore((state) => state.businessId);
  const { data: stats, isLoading: statsLoading } = useDashboardStats(businessId);
  const { data: enabledModules = [] } = useBusinessModules(businessId);
  const { data: offerings = [] } = useOfferings(supabase, businessId ?? "");
  const { data: business } = useBusiness(businessId);
  const can = useCan();
  const repository = getCoreRepository(supabase);

  const { data: recentPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["payment_records", businessId],
    queryFn: () => repository.listPaymentRecords(businessId as string),
    enabled: Boolean(businessId),
  });

  // `to` makes an unfinished step a link, only when that page is reachable for this role / module set
  const sellPath = enabledModules.includes("pos") ? "/app/pos" : enabledModules.includes("booking") ? "/app/booking" : undefined;
  const checklist: Array<{ label: string; done: boolean; to?: string }> = [
    { label: "Finish business setup", done: Boolean(business?.setupCompletedAt), to: can("business.configure") ? "/app/setup" : undefined },
    { label: "Add your first catalog offering", done: offerings.length > 0, to: enabledModules.includes("catalog") ? "/app/catalog" : undefined },
    { label: "Record your first sale or booking", done: recentPayments.length > 0, to: sellPath },
    { label: "Add a teammate", done: (stats?.activeEmployeesCount ?? 0) > 1, to: can("employees.manage") ? "/app/employees" : undefined },
  ];
  const checklistDone = checklist.filter((step) => step.done).length;
  const checklistPercent = Math.round((checklistDone / checklist.length) * 100);
  const availableActions = QUICK_ACTIONS.filter((action) => {
    const permission: Permission | undefined = getModuleDefinition(action.moduleKey)?.permission;
    return enabledModules.includes(action.moduleKey) && (!permission || can(permission));
  });
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description={`${greeting} — here's today's activity across every enabled module.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Today's Sales" value={`₱${(stats?.todaySalesTotal ?? 0).toFixed(2)}`} icon={Wallet} accent="success" isLoading={statsLoading} />
        <StatCard label="Upcoming Bookings" value={stats?.upcomingBookingsCount ?? 0} icon={CalendarClock} accent="info" isLoading={statsLoading} />
        <StatCard label="Active Employees" value={stats?.activeEmployeesCount ?? 0} icon={Users} accent="default" isLoading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card className="lg:col-span-1 animate-slide-up">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {availableActions.length === 0 && (
              <p className="text-sm text-muted-foreground">Enable a module to see quick actions here.</p>
            )}
            {availableActions.map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className="group flex items-center gap-3 rounded-lg border p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated"
              >
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", QUICK_ACTION_TINT[action.tint])}>
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{action.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Getting Started checklist */}
        <Card className="lg:col-span-1 animate-slide-up">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Getting Started</CardTitle>
            <Badge variant={checklistDone === checklist.length ? "success" : "secondary"}>
              {checklistDone}/{checklist.length}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-success transition-all duration-500"
                style={{ width: `${checklistPercent}%` }}
              />
            </div>
            <div className="space-y-2.5 pt-1">
              {checklist.map((step) => (
                <div key={step.label} className="flex items-center gap-2.5 text-sm">
                  {step.done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  {step.done || !step.to ? (
                    <span className={step.done ? "text-muted-foreground line-through" : ""}>{step.label}</span>
                  ) : (
                    <Link to={step.to} className="font-medium hover:text-primary hover:underline">
                      {step.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
            {checklistDone === checklist.length && (
              <div className="flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1.5 text-xs font-medium text-success">
                <Sparkles className="h-3.5 w-3.5" />
                All set up — you're ready to go!
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-1 animate-slide-up">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentsLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!paymentsLoading && recentPayments.length === 0 && (
              <EmptyState icon={Receipt} title="No activity yet" description="Sales and paid bookings will show up here." className="border-0 py-6" />
            )}
            <div className="space-y-1">
              {recentPayments.slice(0, 5).map((record) => {
                const SourceIcon = SOURCE_MODULE_ICON[record.sourceModule] ?? Receipt;
                return (
                  <div key={record.id} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent/60">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <SourceIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium capitalize">{record.sourceModule}</p>
                      <p className="text-xs text-muted-foreground">{record.createdAt.toLocaleString()}</p>
                    </div>
                    <p className="shrink-0 font-semibold">₱{record.amount.toFixed(2)}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
