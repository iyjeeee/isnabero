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
  TriangleAlert,
  Sparkles,
} from "lucide-react";
import { PageHeader, StatCard, TrendBadge, Card, CardContent, CardHeader, CardTitle, Badge, EmptyState, cn } from "@isnabero/ui";
import { useOfferings } from "@isnabero/module-catalog";
import { useStockLevels } from "@isnabero/module-inventory";
import { supabase } from "@/lib/supabase";
import { useBusinessStore } from "@/stores/business-store";
import { useSetupDialogStore } from "@/stores/setup-dialog-store";
import { useBusinessModules } from "@/hooks/use-business-modules";
import { useBusiness } from "@/hooks/use-business";
import { useCan } from "@/hooks/use-permission";
import { getModuleDefinition } from "@/lib/module-registry";
import type { Permission } from "@/lib/permissions";
import { useT, useFormat } from "@/i18n";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { TodayBookingsCard } from "@/components/dashboard/TodayBookingsCard";
import { computePercentChange } from "@/lib/percent-change";
import { StockBadge } from "@/components/inventory/StockBadge";
import { getCoreRepository } from "@/lib/repositories/get-repository";
import { formatAmount, formatPeso } from "@/lib/money";

// QUICK_ACTIONS: shortcuts to the most common next step per module — kept in sync manually with
// MODULE_REGISTRY since each action has bespoke copy, unlike the sidebar's generic nav entries.
// `tint` picks the same semantic accent family as StatCard so the tiles feel like one system.
// A module's own role gate (MODULE_REGISTRY permission) also hides its quick action from roles without access.
const QUICK_ACTIONS = [
  { path: "/app/pos", icon: ShoppingCart, moduleKey: "pos" as const, tint: "success" as const },
  { path: "/app/catalog", icon: LayoutGrid, moduleKey: "catalog" as const, tint: "default" as const },
  { path: "/app/booking", icon: CalendarClock, moduleKey: "booking" as const, tint: "info" as const },
  { path: "/app/expenses", icon: Receipt, moduleKey: "expenses" as const, tint: "warning" as const },
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
  const { t } = useT();
  const format = useFormat();
  const businessId = useBusinessStore((state) => state.businessId);
  const { data: stats, isLoading: statsLoading } = useDashboardStats(businessId);
  const { data: enabledModules = [] } = useBusinessModules(businessId);
  const { data: offerings = [] } = useOfferings(supabase, businessId ?? "");
  const { data: business } = useBusiness(businessId);
  const can = useCan();
  const setSetupOpen = useSetupDialogStore((state) => state.setOpen);
  const inventoryOn = enabledModules.includes("inventory");
  const { data: stockLevels = [] } = useStockLevels(supabase, inventoryOn ? (businessId ?? "") : ""); // empty id keeps the query off when Inventory is disabled
  const stockAlerts = stockLevels.filter((level) => level.status !== "ok").sort((a, b) => (a.status === b.status ? a.offeringName.localeCompare(b.offeringName) : a.status === "out" ? -1 : 1));
  const repository = getCoreRepository(supabase);

  const { data: recentPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["payment_records", businessId],
    queryFn: () => repository.listPaymentRecords(businessId as string),
    enabled: Boolean(businessId),
  });

  // `to` makes an unfinished step a link, only when that page is reachable for this role / module set
  const sellPath = enabledModules.includes("pos") ? "/app/pos" : enabledModules.includes("booking") ? "/app/booking" : undefined;
  const checklist: Array<{ id: string; label: string; done: boolean; to?: string; action?: () => void }> = [
    { id: "setup", label: t("dashboard.checklist.setup"), done: Boolean(business?.setupCompletedAt), action: can("business.configure") ? () => setSetupOpen(true) : undefined },
    { id: "catalog", label: t("dashboard.checklist.catalog"), done: offerings.length > 0, to: enabledModules.includes("catalog") ? "/app/catalog" : undefined },
    { id: "firstSale", label: t("dashboard.checklist.firstSale"), done: recentPayments.length > 0, to: sellPath },
    { id: "teammate", label: t("dashboard.checklist.teammate"), done: (stats?.activeEmployeesCount ?? 0) > 1, to: can("employees.manage") ? "/app/employees" : undefined },
  ];
  const checklistDone = checklist.filter((step) => step.done).length;
  const checklistPercent = Math.round((checklistDone / checklist.length) * 100);
  const availableActions = QUICK_ACTIONS.filter((action) => {
    const permission: Permission | undefined = getModuleDefinition(action.moduleKey)?.permission;
    return enabledModules.includes(action.moduleKey) && (!permission || can(permission));
  });
  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? "dashboard.greeting.morning" : hour < 18 ? "dashboard.greeting.afternoon" : "dashboard.greeting.evening");
  const sourceLabel = (source: string) => (source === "pos" ? t("payments.source.pos") : source === "booking" ? t("payments.source.booking") : source);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={LayoutDashboard}
        title={t("dashboard.title")}
        description={t("dashboard.description", { greeting })}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label={t("dashboard.stats.todaySales")}
          value={formatPeso(stats?.todaySalesTotal ?? 0)}
          icon={Wallet}
          accent="success"
          isLoading={statsLoading}
          helpText={
            stats && (
              <span className="flex flex-col gap-0.5">
                <TrendBadge percentChange={computePercentChange(stats.todaySalesTotal, stats.yesterdaySalesTotal)} label={t("dashboard.vsYesterday")} />
                <span className="text-xs text-muted-foreground">{t("dashboard.yesterdayByNow", { amount: formatAmount(stats.yesterdaySalesTotal) })}</span>
              </span>
            )
          }
        />
        <StatCard label={t("dashboard.stats.upcomingBookings")} value={stats?.upcomingBookingsCount ?? 0} icon={CalendarClock} accent="info" isLoading={statsLoading} />
        <StatCard label={t("dashboard.stats.activeEmployees")} value={stats?.activeEmployeesCount ?? 0} icon={Users} accent="default" isLoading={statsLoading} />
      </div>

      {/* side by side on wide screens so each card is only as wide as its content needs */}
      <div className="grid grid-cols-1 items-start gap-4 empty:hidden lg:grid-cols-2">
        {enabledModules.includes("booking") && businessId && <TodayBookingsCard businessId={businessId} />}

        {inventoryOn && stockAlerts.length > 0 && (
          <Card className="animate-slide-up border-warning/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <TriangleAlert className="h-4 w-4 text-warning" />
                {t("dashboard.stockAlerts.title")}
              </CardTitle>
              <Link to="/app/inventory" className="text-sm font-medium text-primary hover:underline">
                {t("dashboard.stockAlerts.openInventory")}
              </Link>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-x-6 gap-y-2">
              {stockAlerts.map((level) => (
                <div key={level.offeringId} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{level.offeringName}</span>
                  <StockBadge level={level} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Quick Actions */}
        <Card className="lg:col-span-1 animate-slide-up">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.quickActions.title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {availableActions.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("dashboard.quickActions.empty")}</p>
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
                  <p className="text-sm font-medium">{t(`dashboard.quickActions.${action.moduleKey}.label`)}</p>
                  <p className="truncate text-xs text-muted-foreground">{t(`dashboard.quickActions.${action.moduleKey}.description`)}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Getting Started checklist */}
        <Card className="lg:col-span-1 animate-slide-up">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{t("dashboard.checklist.title")}</CardTitle>
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
                <div key={step.id} className="flex items-center gap-2.5 text-sm">
                  {step.done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  {step.done || (!step.to && !step.action) ? (
                    <span className={step.done ? "text-muted-foreground line-through" : ""}>{step.label}</span>
                  ) : step.action ? (
                    <button type="button" onClick={step.action} className="font-medium hover:text-primary hover:underline">
                      {step.label}
                    </button>
                  ) : (
                    <Link to={step.to!} className="font-medium hover:text-primary hover:underline">
                      {step.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
            {checklistDone === checklist.length && (
              <div className="flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1.5 text-xs font-medium text-success">
                <Sparkles className="h-3.5 w-3.5" />
                {t("dashboard.checklist.allDone")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-1 animate-slide-up">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.activity.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentsLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
            {!paymentsLoading && recentPayments.length === 0 && (
              <EmptyState icon={Receipt} title={t("dashboard.activity.emptyTitle")} description={t("dashboard.activity.emptyDescription")} className="border-0 py-6" />
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
                      <p className="truncate font-medium">{sourceLabel(record.sourceModule)}</p>
                      <p className="text-xs text-muted-foreground">{format.dateTime(record.createdAt)}</p>
                    </div>
                    <p className="shrink-0 font-semibold">{formatPeso(record.amount)}</p>
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
