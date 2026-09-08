import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Receipt, TrendingUp, Search, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useBusinessStore } from "@/stores/business-store";
import { getCoreRepository } from "@/lib/repositories/get-repository";
import { useHasRole } from "@/hooks/use-has-role";
import { usePagination } from "@/hooks/use-pagination";
import { exportToCsv } from "@/lib/export-csv";
import { Card, CardContent, Badge, PageHeader, EmptyState, Skeleton, StatCard, FilterBar, Input, Button, Pagination, cn } from "@isnabero/ui";
import { VoidPaymentRecordButton } from "@/components/payments/VoidPaymentRecordButton";

const METHOD_BADGE_VARIANT = { cash: "success", gcash: "info", bank_transfer: "default", other: "secondary" } as const;
const METHOD_TABS = [
  { value: "all", label: "All" },
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "bank_transfer", label: "Bank" },
  { value: "other", label: "Other" },
] as const;
const PAGE_SIZE = 10;

export default function PaymentsPage() {
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const repository = getCoreRepository(supabase);
  const canManage = useHasRole(["owner", "admin"]);

  const [showVoided, setShowVoided] = useState(false);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["payment_records", businessId, showVoided],
    queryFn: () => repository.listPaymentRecords(businessId, { includeVoided: showVoided }),
    enabled: Boolean(businessId),
  });

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<(typeof METHOD_TABS)[number]["value"]>("all");

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesMethod = methodFilter === "all" || record.method === methodFilter;
      const matchesSearch =
        search === "" ||
        (record.referenceCode ?? "").toLowerCase().includes(search.toLowerCase()) ||
        record.sourceModule.toLowerCase().includes(search.toLowerCase());
      return matchesMethod && matchesSearch;
    });
  }, [records, search, methodFilter]);

  const { page, setPage, totalPages, pageItems, totalItems } = usePagination(filteredRecords, PAGE_SIZE);

  // Stats always computed over active (non-voided) records only, regardless of the "Show voided" toggle
  const activeRecords = records.filter((record) => !record.voidedAt);
  const totalAmount = activeRecords.reduce((sum, record) => sum + record.amount, 0);
  const averageAmount = activeRecords.length > 0 ? totalAmount / activeRecords.length : 0;

  const handleExport = () => {
    exportToCsv(
      `payment-records-${new Date().toISOString().slice(0, 10)}.csv`,
      filteredRecords.map((record) => ({
        Date: record.createdAt.toISOString(),
        Source: record.sourceModule,
        Method: record.method,
        Reference: record.referenceCode ?? "",
        Amount: record.amount,
        Status: record.voidedAt ? "Voided" : "Active",
      })),
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Wallet}
        title="Payment Records"
        description="Every transaction, regardless of which module created it."
        action={
          <Button variant="outline" onClick={handleExport} disabled={filteredRecords.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Transactions" value={activeRecords.length} icon={Receipt} accent="default" isLoading={isLoading} />
        <StatCard label="Total Collected" value={`₱${totalAmount.toFixed(2)}`} icon={Wallet} accent="success" isLoading={isLoading} />
        <StatCard label="Average Transaction" value={`₱${averageAmount.toFixed(2)}`} icon={TrendingUp} accent="info" isLoading={isLoading} />
      </div>

      {records.length > 0 && (
        <FilterBar>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 overflow-x-auto rounded-lg border bg-background p-1">
              {METHOD_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setMethodFilter(tab.value)}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    methodFilter === tab.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showVoided} onChange={(event) => setShowVoided(event.target.checked)} className="h-4 w-4 rounded border-input" />
              Show voided
            </label>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search reference or source…" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
          </div>
        </FilterBar>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="space-y-3 p-5">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {!isLoading && records.length === 0 && (
            <EmptyState icon={Wallet} title="No transactions yet" description="Sales from POS and paid bookings will show up here." className="border-0" />
          )}

          {!isLoading && records.length > 0 && filteredRecords.length === 0 && (
            <EmptyState icon={Search} title="No matches" description="Try a different search term or method filter." className="border-0" />
          )}

          {!isLoading && pageItems.length > 0 && (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((record) => (
                  <tr key={record.id} className={cn("border-b transition-colors last:border-0 hover:bg-accent/50", record.voidedAt && "opacity-50")}>
                    <td className="px-4 py-3">{record.createdAt.toLocaleString()}</td>
                    <td className="px-4 py-3 capitalize">{record.sourceModule}</td>
                    <td className="px-4 py-3">
                      <Badge variant={METHOD_BADGE_VARIANT[record.method as keyof typeof METHOD_BADGE_VARIANT] ?? "secondary"} className="capitalize">
                        {record.method.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{record.referenceCode ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      ₱{record.amount.toFixed(2)}
                      {record.voidedAt && (
                        <Badge variant="destructive" className="ml-2">
                          Voided
                        </Badge>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          {!record.voidedAt && (
                            <VoidPaymentRecordButton businessId={businessId} recordId={record.id} amountLabel={`₱${record.amount.toFixed(2)}`} />
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
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
