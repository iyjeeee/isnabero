import { useMemo, useState } from "react";
import { Boxes, PackageX, TriangleAlert, Search, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, PageHeader, EmptyState, Skeleton, StatCard, FilterBar, Input, Pagination, cn } from "@isnabero/ui";
import { useStockLevels, useStockMovements, formatDelta } from "@isnabero/module-inventory";
import { supabase } from "@/lib/supabase";
import { useBusinessStore } from "@/stores/business-store";
import { useFormat, useLabels, useT } from "@/i18n";
import { usePermission } from "@/hooks/use-permission";
import { usePagination } from "@/hooks/use-pagination";
import { stockMovementRows, stockRows } from "@/lib/export-rows";
import { ExportButton } from "@/components/ExportButton";
import { StockBadge } from "@/components/inventory/StockBadge";
import { TrackItemModal } from "@/components/inventory/TrackItemModal";
import { AdjustStockModal } from "@/components/inventory/AdjustStockModal";
import { ItemSettingsModal } from "@/components/inventory/ItemSettingsModal";
import { MovementDetailDialog, StockItemDetailDialog } from "@/components/details/StockDetailDialogs";
import { OPEN_CLASS, openProps } from "@/components/details/open-props";

const STATUS_TABS = [
  { value: "all", labelKey: "common.all" },
  { value: "low", labelKey: "inventory.page.tabLow" },
  { value: "out", labelKey: "inventory.page.tabOut" },
] as const;
const PAGE_SIZE = 10;

export default function InventoryPage() {
  const { t } = useT();
  const labels = useLabels();
  const format = useFormat();
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const canManage = usePermission("inventory.manage");
  const { data: levels = [], isLoading } = useStockLevels(supabase, businessId);
  const { data: movements = [], isLoading: movementsLoading } = useStockMovements(supabase, businessId);

  const [itemDetailId, setItemDetailId] = useState<string | null>(null);
  const [movementDetailId, setMovementDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]["value"]>("all");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return levels.filter((level) => (statusFilter === "all" || level.status === statusFilter) && (term === "" || level.offeringName.toLowerCase().includes(term)));
  }, [levels, search, statusFilter]);

  const items = usePagination(filtered, PAGE_SIZE);
  const history = usePagination(movements, PAGE_SIZE);
  const lowCount = levels.filter((level) => level.status === "low").length;
  const outCount = levels.filter((level) => level.status === "out").length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Boxes}
        title={t("inventory.page.title")}
        description={t("inventory.page.description")}
        action={
          <div className="flex items-center gap-2">
            <ExportButton title="Inventory" filenamePrefix="inventory" disabled={filtered.length === 0} buildRows={() => stockRows(filtered)} />
            {canManage && <TrackItemModal businessId={businessId} tracked={levels} />}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("inventory.page.trackedItems")} value={levels.length} icon={Boxes} accent="default" isLoading={isLoading} />
        <StatCard label={t("inventory.page.lowStock")} value={lowCount} icon={TriangleAlert} accent="warning" isLoading={isLoading} />
        <StatCard label={t("inventory.page.outOfStock")} value={outCount} icon={PackageX} accent="info" isLoading={isLoading} />
      </div>

      <FilterBar>
        <div className="flex gap-1 overflow-x-auto rounded-lg border bg-background p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={cn("shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors", statusFilter === tab.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("inventory.page.searchPlaceholder")} aria-label={t("inventory.page.searchAria")} value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
        </div>
      </FilterBar>

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="space-y-3 p-5">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}
          {!isLoading && levels.length === 0 && (
            <EmptyState
              icon={Boxes}
              title={t("inventory.empty.noneTitle")}
              description={canManage ? t("inventory.empty.noneManage") : t("inventory.empty.noneReadonly")}
              className="border-0"
            />
          )}
          {!isLoading && levels.length > 0 && filtered.length === 0 && <EmptyState icon={Search} title={t("inventory.empty.noMatchesTitle")} description={t("inventory.empty.noMatchesDescription")} className="border-0" />}
          {!isLoading && items.pageItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">{t("inventory.table.item")}</th>
                    <th className="px-4 py-3">{t("common.status")}</th>
                    <th className="px-4 py-3 text-right">{t("inventory.table.inStock")}</th>
                    <th className="px-4 py-3 text-right">{t("inventory.table.warnAt")}</th>
                    {canManage && <th className="px-4 py-3 text-right">{t("common.actions")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.pageItems.map((level) => (
                    <tr key={level.offeringId} {...openProps(() => setItemDetailId(level.offeringId))} title={t("details.open", { name: level.offeringName })} className={cn("border-b transition-colors last:border-0 hover:bg-accent/50", OPEN_CLASS)}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{level.offeringName}</p>
                        <p className="text-xs text-muted-foreground">{labels.offeringType(level.offeringType)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StockBadge level={level} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{level.quantity}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{level.lowStockThreshold > 0 ? level.lowStockThreshold : "—"}</td>
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <AdjustStockModal businessId={businessId} level={level} />
                            <ItemSettingsModal businessId={businessId} level={level} />
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!isLoading && items.pageItems.length > 0 && (
            <div className="px-4">
              <Pagination page={items.page} totalPages={items.totalPages} onPageChange={items.setPage} totalItems={items.totalItems} pageSize={PAGE_SIZE} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            {t("inventory.history.title")}
          </CardTitle>
          <ExportButton title="Stock History" filenamePrefix="stock-history" withDateRange disabled={movements.length === 0} buildRows={(range) => stockMovementRows(movements, range)} />
        </CardHeader>
        <CardContent className="p-0">
          {movementsLoading && <Skeleton className="m-5 h-24" />}
          {!movementsLoading && movements.length === 0 && <EmptyState icon={History} title={t("inventory.history.emptyTitle")} description={t("inventory.history.emptyDescription")} className="border-0" />}
          {!movementsLoading && history.pageItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">{t("inventory.history.when")}</th>
                    <th className="px-4 py-3">{t("inventory.history.item")}</th>
                    <th className="px-4 py-3">{t("inventory.history.type")}</th>
                    <th className="px-4 py-3 text-right">{t("inventory.history.change")}</th>
                    <th className="px-4 py-3">{t("inventory.history.reason")}</th>
                    <th className="px-4 py-3">{t("inventory.history.by")}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.pageItems.map((movement) => (
                    <tr key={movement.id} {...openProps(() => setMovementDetailId(movement.id))} title={t("details.open", { name: movement.offeringName })} className={cn("border-b last:border-0 hover:bg-accent/50", OPEN_CLASS)}>
                      <td className="whitespace-nowrap px-4 py-3">{format.dateTime(movement.createdAt)}</td>
                      <td className="px-4 py-3">{movement.offeringName}</td>
                      <td className="px-4 py-3">
                        <Badge variant={movement.kind === "sale" ? "info" : "secondary"}>{labels.stockKind(movement.kind)}</Badge>
                      </td>
                      <td className={cn("px-4 py-3 text-right font-medium tabular-nums", movement.delta > 0 ? "text-success" : "text-destructive")}>{formatDelta(movement.delta)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{movement.note ?? "—"}</td>
                      <td className="px-4 py-3">{movement.recordedByName ?? t("inventory.history.system")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!movementsLoading && history.pageItems.length > 0 && (
            <div className="px-4">
              <Pagination page={history.page} totalPages={history.totalPages} onPageChange={history.setPage} totalItems={history.totalItems} pageSize={PAGE_SIZE} />
            </div>
          )}
        </CardContent>
      </Card>
      <StockItemDetailDialog level={levels.find((level) => level.offeringId === itemDetailId) ?? null} movements={movements} onClose={() => setItemDetailId(null)} />
      <MovementDetailDialog movement={movements.find((movement) => movement.id === movementDetailId) ?? null} onClose={() => setMovementDetailId(null)} />
    </div>
  );
}
