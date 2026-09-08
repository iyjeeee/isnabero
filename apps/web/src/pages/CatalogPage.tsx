import { useMemo, useState } from "react";
import { PackageOpen, LayoutGrid, Search } from "lucide-react";
import { useOfferings, useToggleOfferingAvailability } from "@isnabero/module-catalog";
import { Card, CardContent, Button, Badge, PageHeader, EmptyState, Skeleton, Input, FilterBar, Pagination, cn } from "@isnabero/ui";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useBusinessStore } from "@/stores/business-store";
import { usePagination } from "@/hooks/use-pagination";
import { CreateOfferingModal } from "@/components/catalog/CreateOfferingModal";

const TYPE_BADGE_VARIANT = { item: "default", bundle: "info", addon: "secondary" } as const;
const TYPE_TABS = [
  { value: "all", label: "All" },
  { value: "item", label: "Items" },
  { value: "bundle", label: "Bundles" },
  { value: "addon", label: "Add-ons" },
] as const;
const PAGE_SIZE = 9;

export default function CatalogPage() {
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const { data: offerings = [], isLoading } = useOfferings(supabase, businessId);
  const toggleAvailability = useToggleOfferingAvailability(supabase, businessId);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_TABS)[number]["value"]>("all");

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
      { onSuccess: () => toast.success(isAvailable ? `${name} marked available` : `${name} marked sold out`) },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutGrid}
        title="Catalog"
        description="Items, bundles, and add-ons shared across POS and Booking."
        action={<CreateOfferingModal businessId={businessId} />}
      />

      {offerings.length > 0 && (
        <FilterBar>
          <div className="flex gap-1 rounded-lg border bg-background p-1">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setTypeFilter(tab.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  typeFilter === tab.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search offerings…" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
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
          title="No offerings yet"
          description="Add your first item, bundle, or add-on — it'll be available to POS and Booking right away."
          action={<CreateOfferingModal businessId={businessId} />}
        />
      )}

      {!isLoading && offerings.length > 0 && filteredOfferings.length === 0 && (
        <EmptyState icon={Search} title="No matches" description="Try a different search term or filter." />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pageItems.map((offering) => (
          <Card key={offering.id} interactive>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{offering.name}</p>
                  <Badge variant={TYPE_BADGE_VARIANT[offering.type]} className="mt-1 capitalize">
                    {offering.type}
                  </Badge>
                </div>
                <p className="shrink-0 font-semibold">₱{Number(offering.price).toFixed(2)}</p>
              </div>

              {offering.description && <p className="text-sm text-muted-foreground">{offering.description}</p>}

              {offering.inclusions.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {offering.inclusions.map((inclusion: { id: string; label: string; quantity: number | null }) => (
                    <li key={inclusion.id} className="text-muted-foreground">
                      • {inclusion.label}
                      {inclusion.quantity ? ` (${inclusion.quantity})` : ""}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center justify-between pt-1">
                <Badge variant={offering.isAvailable ? "success" : "destructive"}>
                  {offering.isAvailable ? "Available" : "Sold out"}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggle(offering.id, !offering.isAvailable, offering.name)}
                >
                  {offering.isAvailable ? "Mark sold out" : "Mark available"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} pageSize={PAGE_SIZE} />
    </div>
  );
}
