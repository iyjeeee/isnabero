import { useMemo, useState } from "react";
import { PackageOpen, LayoutGrid, Search, Box, Layers, PlusCircle } from "lucide-react";
import { useOfferings, useToggleOfferingAvailability } from "@isnabero/module-catalog";
import { useStockLevels } from "@isnabero/module-inventory";
import { Card, CardContent, Button, Badge, PageHeader, EmptyState, Skeleton, Input, FilterBar, Pagination, cn } from "@isnabero/ui";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useT, useLabels } from "@/i18n";
import { useBusinessStore } from "@/stores/business-store";
import { usePagination } from "@/hooks/use-pagination";
import { ExportButton } from "@/components/ExportButton";
import { offeringRows } from "@/lib/export-rows";
import { StockBadge } from "@/components/inventory/StockBadge";
import { CreateOfferingModal } from "@/components/catalog/CreateOfferingModal";
import { OfferingActions } from "@/components/catalog/OfferingActions";
import { formatPeso } from "@/lib/money";
import { OfferingDetailDialog } from "@/components/details/OfferingDetailDialog";
import { OPEN_CLASS, openProps } from "@/components/details/open-props";

const TYPE_BADGE_VARIANT = { item: "default", bundle: "info", addon: "secondary" } as const;
// TYPE_ICON/TYPE_TILE_TINT: give every offering card a type-specific icon tile instead of a bare name —
// the same accent-tint pattern StatCard uses, so the whole app reads as one visual system.
const TYPE_ICON = { item: Box, bundle: Layers, addon: PlusCircle } as const;
const TYPE_TILE_TINT = {
  item: "bg-primary/10 text-primary",
  bundle: "bg-info/10 text-info",
  addon: "bg-secondary text-secondary-foreground",
} as const;
const TYPE_TABS = ["all", "item", "bundle", "addon"] as const;
const PAGE_SIZE = 9;

export default function CatalogPage() {
  const { t } = useT();
  const labels = useLabels();
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const { data: offerings = [], isLoading } = useOfferings(supabase, businessId);
  const toggleAvailability = useToggleOfferingAvailability(supabase, businessId);
  const { data: stockLevels = [] } = useStockLevels(supabase, businessId);
  const stockByOffering = new Map(stockLevels.map((level) => [level.offeringId, level]));

  const [detailId, setDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_TABS)[number]>("all");

  const filteredOfferings = useMemo(() => {
    return offerings.filter((offering) => {
      const matchesType = typeFilter === "all" || offering.type === typeFilter;
      const matchesSearch = offering.name.toLowerCase().includes(search.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [offerings, search, typeFilter]);

  const { page, setPage, totalPages, pageItems, totalItems } = usePagination(filteredOfferings, PAGE_SIZE);

  const handleToggle = (offeringId: string, isAvailable: boolean, name: string) => {
    toggleAvailability.mutate(
      { offeringId, isAvailable },
      { onSuccess: () => toast.success(t(isAvailable ? "catalog.page.markedAvailable" : "catalog.page.markedSoldOut", { name })) },
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={LayoutGrid}
        title={t("catalog.page.title")}
        description={t("catalog.page.description")}
        action={
          <div className="flex items-center gap-2">
            <ExportButton title="Catalog" filenamePrefix="catalog" moneyColumns={["Price"]} disabled={filteredOfferings.length === 0} buildRows={() => offeringRows(filteredOfferings)} />
            <CreateOfferingModal businessId={businessId} />
          </div>
        }
      />

      {offerings.length > 0 && (
        <FilterBar>
          <div className="flex gap-1 rounded-lg border bg-background p-1">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setTypeFilter(tab)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  typeFilter === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {t(`catalog.tabs.${tab}`)}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t("catalog.page.searchPlaceholder")} value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
          </div>
        </FilterBar>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && offerings.length === 0 && (
        <EmptyState
          icon={PackageOpen}
          title={t("catalog.page.emptyTitle")}
          description={t("catalog.page.emptyDescription")}
          action={<CreateOfferingModal businessId={businessId} />}
        />
      )}

      {!isLoading && offerings.length > 0 && filteredOfferings.length === 0 && (
        <EmptyState icon={Search} title={t("catalog.page.noMatchesTitle")} description={t("catalog.page.noMatchesDescription")} />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pageItems.map((offering) => {
          const TypeIcon = TYPE_ICON[offering.type];
          return (
            <Card key={offering.id} interactive {...openProps(() => setDetailId(offering.id))} title={t("details.open", { name: offering.name })} className={cn("flex flex-col", OPEN_CLASS, !offering.isAvailable && "opacity-70")}>
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", TYPE_TILE_TINT[offering.type])}>
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="truncate font-semibold leading-tight">{offering.name}</p>
                      <Badge variant={TYPE_BADGE_VARIANT[offering.type]} className="mt-1.5 capitalize">
                        {labels.offeringType(offering.type)}
                      </Badge>
                    </div>
                  </div>
                  <p className="shrink-0 font-display text-lg font-bold text-primary">{formatPeso(offering.price)}</p>
                </div>

                {offering.description && <p className="text-sm text-muted-foreground">{offering.description}</p>}

                {offering.inclusions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {offering.inclusions.map((inclusion: { id: string; label: string; quantity: number | null }) => (
                      <span
                        key={inclusion.id}
                        className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                      >
                        {inclusion.label}
                        {inclusion.quantity ? ` × ${inclusion.quantity}` : ""}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={offering.isAvailable ? "success" : "destructive"}>
                      {offering.isAvailable ? t("catalog.page.available") : t("catalog.page.soldOut")}
                    </Badge>
                    {stockByOffering.has(offering.id) && <StockBadge level={stockByOffering.get(offering.id)!} />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(offering.id, !offering.isAvailable, offering.name)}
                    >
                      {offering.isAvailable ? t("catalog.page.markSoldOut") : t("catalog.page.markAvailable")}
                    </Button>
                    <OfferingActions businessId={businessId} offering={offering} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} pageSize={PAGE_SIZE} />
      <OfferingDetailDialog offering={offerings.find((offering) => offering.id === detailId) ?? null} stock={detailId ? stockByOffering.get(detailId) : undefined} onClose={() => setDetailId(null)} />
    </div>
  );
}
