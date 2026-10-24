import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Search } from "lucide-react";
import type { AuditEntity } from "@isnabero/db";
import { Card, CardContent, Badge, PageHeader, EmptyState, Skeleton, FilterBar, Input, Pagination, cn } from "@isnabero/ui";
import { supabase } from "@/lib/supabase";
import { useBusinessStore } from "@/stores/business-store";
import { getCoreRepository } from "@/lib/repositories/get-repository";
import { useFormat, useLabels, useT, type TranslationKey } from "@/i18n";
import { usePagination } from "@/hooks/use-pagination";
import { auditLogRows } from "@/lib/export-rows";
import { ExportButton } from "@/components/ExportButton";
import { AuditDetailDialog } from "@/components/details/AuditDetailDialog";
import { OPEN_CLASS, openProps } from "@/components/details/open-props";

const ENTITY_TABS = [
  { value: "all", labelKey: "common.all" },
  { value: "sale", labelKey: "audit.tabs.sale" },
  { value: "payment", labelKey: "audit.tabs.payment" },
  { value: "booking", labelKey: "audit.tabs.booking" },
  { value: "offering", labelKey: "audit.tabs.offering" },
  { value: "stock", labelKey: "audit.tabs.stock" },
  { value: "shift", labelKey: "audit.tabs.shift" },
  { value: "expense", labelKey: "audit.tabs.expense" },
  { value: "employee", labelKey: "audit.tabs.employee" },
  { value: "cash_close", labelKey: "audit.tabs.cash_close" },
  { value: "business", labelKey: "audit.tabs.business" },
] as const satisfies readonly { value: "all" | AuditEntity; labelKey: TranslationKey }[];
const ENTITY_BADGE_VARIANT: Record<AuditEntity, "default" | "success" | "info" | "warning" | "secondary" | "destructive"> = {
  sale: "success",
  payment: "destructive",
  booking: "info",
  offering: "default",
  expense: "warning",
  stock: "info",
  shift: "default",
  employee: "secondary",
  business: "secondary",
  cash_close: "info",
};
const PAGE_SIZE = 15;

export default function AuditLogPage() {
  const { t } = useT();
  const labels = useLabels();
  const format = useFormat();
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const repository = getCoreRepository(supabase);
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["audit_log", businessId],
    queryFn: () => repository.listAuditLog(businessId),
    enabled: Boolean(businessId),
    refetchOnMount: "always", // other pages' mutations don't invalidate this query, so always show the latest
  });

  const [detailId, setDetailId] = useState<string | null>(null);
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
    <div className="space-y-5">
      <PageHeader
        icon={ScrollText}
        title={t("audit.title")}
        description={t("audit.description")}
        action={<ExportButton title="Audit Log" filenamePrefix="audit-log" withDateRange hint={t("audit.exportHint")} disabled={filtered.length === 0} buildRows={(range) => auditLogRows(filtered, range)} />}
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
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("audit.searchPlaceholder")} aria-label={t("audit.searchAria")} value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
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
            <EmptyState icon={ScrollText} title={t("audit.empty.noneTitle")} description={t("audit.empty.noneDescription")} className="border-0" />
          )}
          {!isLoading && entries.length > 0 && filtered.length === 0 && <EmptyState icon={Search} title={t("audit.empty.noMatchesTitle")} description={t("audit.empty.noMatchesDescription")} className="border-0" />}
          {!isLoading && pageItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="stack-table w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">{t("audit.table.when")}</th>
                    <th className="px-4 py-3">{t("audit.table.who")}</th>
                    <th className="px-4 py-3">{t("audit.table.action")}</th>
                    <th className="px-4 py-3">{t("audit.table.details")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((entry) => (
                    <tr key={entry.id} {...openProps(() => setDetailId(entry.id))} title={t("details.open", { name: labels.auditAction(entry.action) })} className={cn("border-b transition-colors last:border-0 hover:bg-accent/50", OPEN_CLASS)}>
                      <td data-label={t("audit.table.when")} className="whitespace-nowrap px-4 py-3">{format.dateTime(entry.createdAt)}</td>
                      <td data-label={t("audit.table.who")} className="px-4 py-3">{entry.actorName}</td>
                      <td data-label={t("audit.table.action")} className="px-4 py-3">
                        <Badge variant={ENTITY_BADGE_VARIANT[entry.entityType as AuditEntity] ?? "secondary"}>{labels.auditAction(entry.action)}</Badge>
                      </td>
                      <td data-label={t("audit.table.details")} className="max-w-md px-4 py-3"><p className="line-clamp-2">{entry.summary}</p></td>
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
      <AuditDetailDialog entry={entries.find((entry) => entry.id === detailId) ?? null} onClose={() => setDetailId(null)} />
    </div>
  );
}
