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
} from "lucide-react";
import { PageHeader, StatCard, Card, CardContent, CardHeader, CardTitle, Badge, EmptyState } from "@isnabero/ui";
import { useOfferings } from "@isnabero/module-catalog";
import { supabase } from "@/lib/supabase";
import { useBusinessStore } from "@/stores/business-store";
import { useBusinessModules } from "@/hooks/use-business-modules";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { getCoreRepository } from "@/lib/repositories/get-repository";

// QUICK_ACTIONS: shortcuts to the most common next step per module — kept in sync manually with
// MODULE_REGISTRY since each action has bespoke copy, unlike the sidebar's generic nav entries.
const QUICK_ACTIONS = [
  { label: "Ring up a sale", path: "/app/pos", icon: ShoppingCart, moduleKey: "pos" as const },
  { label: "Add to Catalog", path: "/app/catalog", icon: LayoutGrid, moduleKey: "catalog" as const },
  { label: "New booking", path: "/app/booking", icon: CalendarClock, moduleKey: "booking" as const },
];

export default function DashboardPage() {
  const businessId = useBusinessStore((state) => state.businessId);
  const { data: stats, isLoading: statsLoading } = useDashboardStats(businessId);
  const { data: enabledModules = [] } = useBusinessModules(businessId);
  const { data: offerings = [] } = useOfferings(supabase, businessId ?? "");
  const repository = getCoreRepository(supabase);

  const { data: recentPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["payment_records", businessId],
    queryFn: () => repository.listPaymentRecords(businessId as string),
    enabled: Boolean(businessId),
  });

  const checklist = [
    { label: "Enable a module", done: enabledModules.length > 0 },
    { label: "Add your first catalog offering", done: offerings.length > 0 },
    { label: "Record your first sale or booking", done: recentPayments.length > 0 },
    { label: "Add a teammate", done: (stats?.activeEmployeesCount ?? 0) > 1 },
  ];
  const checklistDone = checklist.filter((step) => step.done).length;
  const availableActions = QUICK_ACTIONS.filter((action) => enabledModules.includes(action.moduleKey));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description="Overview of today's activity across every enabled module."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Today's Sales" value={`₱${(stats?.todaySalesTotal ?? 0).toFixed(2)}`} icon={Wallet} accent="success" isLoading={statsLoading} />
        <StatCard label="Upcoming Bookings" value={stats?.upcomingBookingsCount ?? 0} icon={CalendarClock} accent="info" isLoading={statsLoading} />
        <StatCard label="Active Employees" value={stats?.activeEmployeesCount ?? 0} icon={Users} accent="default" isLoading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {availableActions.length === 0 && (
              <p className="text-sm text-muted-foreground">Enable a module to see quick actions here.</p>
            )}
            {availableActions.map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className="flex items-center justify-between rounded-md border px-3 py-2.5 text-sm font-medium transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated"
              >
                <span className="flex items-center gap-2.5">
                  <action.icon className="h-4 w-4 text-primary" />
                  {action.label}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Getting Started checklist */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Getting Started</CardTitle>
            <Badge variant={checklistDone === checklist.length ? "success" : "secondary"}>
              {checklistDone}/{checklist.length}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklist.map((step) => (
              <div key={step.label} className="flex items-center gap-2.5 text-sm">
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className={step.done ? "text-muted-foreground line-through" : ""}>{step.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentsLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!paymentsLoading && recentPayments.length === 0 && (
              <EmptyState icon={Receipt} title="No activity yet" description="Sales and paid bookings will show up here." className="border-0 py-6" />
            )}
            <div className="space-y-3">
              {recentPayments.slice(0, 5).map((record) => (
                <div key={record.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium capitalize">{record.sourceModule}</p>
                    <p className="text-xs text-muted-foreground">{record.createdAt.toLocaleString()}</p>
                  </div>
                  <p className="font-semibold">₱{record.amount.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
