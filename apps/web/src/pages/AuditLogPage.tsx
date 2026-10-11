import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Search } from "lucide-react";
import { getAuditActionLabel, type AuditEntity } from "@isnabero/db";
import { Card, CardContent, Badge, PageHeader, EmptyState, Skeleton, FilterBar, Input, Pagination, cn } from "@isnabero/ui";
import { supabase } from "@/lib/supabase";
import { useBusinessStore } from "@/stores/business-store";
import { getCoreRepository } from "@/lib/repositories/get-repository";
import { usePagination } from "@/hooks/use-pagination";
import { auditLogRows } from "@/lib/export-rows";
import { ExportButton } from "@/components/ExportButton";

const ENTITY_TABS: { value: "all" | AuditEntity; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sale", label: "Sales" },
  { value: "payment", label: "Payments" },
  { value: "booking", label: "Bookings" },
  { value: "offering", label: "Catalog" },
  { value: "stock", label: "Stock" },
  { value: "expense", label: "Expenses" },
  { value: "employee", label: "Employees" },
  { value: "business", label: "Business" },
];
const ENTITY_BADGE_VARIANT: Record<AuditEntity, "default" | "success" | "info" | "warning" | "secondary" | "destructive"> = {
  sale: "success",
  payment: "destructive",
  booking: "info",
  offering: "default",
  expense: "warning",
  stock: "info",
  employee: "secondary",
  business: "secondary",
};
const PAGE_SIZE = 15;

export default function AuditLogPage() {
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const repository = getCoreRepository(supabase);
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["audit_log", businessId],
    queryFn: () => repository.listAuditLog(businessId),
    enabled: Boolean(businessId),
    refetchOnMount: "always", // other pages' mutations don't invalidate this query, so always show the latest
  });

  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<"all" | AuditEntity>("all");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchesEntity = entityFilter === "all" || entry.entityType === entityFilter;
      const matchesSearch = term === "" || entry.summary.toLowerCase().includes(term) || entry.actorName.toLowerCase().includes(term);
      return matchesEntity && matchesSearch;
    });
  }, [entries, search, entityFilter]);

  const { page, setPage, totalPages, pageItems, totalItems } = usePagination(filtered, PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ScrollText}
        title="Audit Log"
        description="Who did what, and when. Entries can't be edited or deleted."
        action={<ExportButton title="Audit Log" filenamePrefix="audit-log" withDateRange hint="Uses the filter and search currently applied." disabled={filtered.length === 0} buildRows={(range) => auditLogRows(filtered, range)} />}
      />

      <FilterBar>
        <div className="flex gap-1 overflow-x-auto rounded-lg border bg-background p-1">
          {ENTITY_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setEntityFilter(tab.value)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                entityFilter === tab.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search person or details…" aria-label="Search audit log" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
        </div>
      </FilterBar>

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="space-y-3 p-5">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}
          {!isLoading && entries.length === 0 && (
            <EmptyState icon={ScrollText} title="Nothing logged yet" description="Sales, voids, bookings, expenses and staff changes will appear here as they happen." className="border-0" />
          )}
          {!isLoading && entries.length > 0 && filtered.length === 0 && <EmptyState icon={Search} title="No matches" description="Try a different search term or filter." className="border-0" />}
          {!isLoading && pageItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Who</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((entry) => (
                    <tr key={entry.id} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                      <td className="whitespace-nowrap px-4 py-3">{entry.createdAt.toLocaleString()}</td>
                      <td className="px-4 py-3">{entry.actorName}</td>
                      <td className="px-4 py-3">
                        <Badge variant={ENTITY_BADGE_VARIANT[entry.entityType as AuditEntity] ?? "secondary"}>{getAuditActionLabel(entry.action)}</Badge>
                      </td>
                      <td className="px-4 py-3">{entry.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!isLoading && pageItems.length > 0 && (
            <div className="px-4">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} pageSize={PAGE_SIZE} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
