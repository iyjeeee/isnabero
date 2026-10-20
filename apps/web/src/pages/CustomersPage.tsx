import { useMemo, useState } from "react";
import { Contact, Search } from "lucide-react";
import { useBookings } from "@isnabero/module-booking";
import { Card, CardContent, EmptyState, FilterBar, Input, PageHeader, Pagination, Skeleton } from "@isnabero/ui";
import { supabase } from "@/lib/supabase";
import { useBusinessStore } from "@/stores/business-store";
import { useFormat, useT } from "@/i18n";
import { formatPeso } from "@/lib/money";
import { groupCustomers, type Customer } from "@/lib/customers";
import { usePagination } from "@/hooks/use-pagination";
import { CustomerDetailDialog } from "@/components/details/CustomerDetailDialog";
import { OPEN_CLASS, openProps } from "@/components/details/open-props";

const PAGE_SIZE = 15;
// every booking ever made (and anything booked ahead): fixed bounds keep the query key stable
const FROM = "2000-01-01T00:00:00.000Z";
const TO = new Date(Date.now() + 5 * 365 * 86_400_000).toISOString();

export default function CustomersPage() {
  const { t } = useT();
  const format = useFormat();
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const { data: bookings = [], isLoading } = useBookings(supabase, businessId, FROM, TO);
  const customers = useMemo(() => groupCustomers(bookings), [bookings]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    const digits = term.replace(/\D/g, "");
    return customers.filter((customer) => customer.name.toLowerCase().includes(term) || (customer.contact ?? "").toLowerCase().includes(term) || (digits.length >= 3 && (customer.contact ?? "").replace(/\D/g, "").includes(digits)));
  }, [customers, search]);
  const { page, setPage, totalPages, pageItems, totalItems } = usePagination(filtered, PAGE_SIZE);
  const dash = t("customers.none");

  return (
    <div className="space-y-5">
      <PageHeader icon={Contact} title={t("customers.title")} description={t("customers.description")} />

      {customers.length > 0 && (
        <FilterBar className="sm:justify-start">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t("customers.searchPlaceholder")} aria-label={t("customers.searchAria")} value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
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
          {!isLoading && customers.length === 0 && <EmptyState icon={Contact} title={t("customers.emptyTitle")} description={t("customers.emptyDescription")} className="border-0" />}
          {!isLoading && customers.length > 0 && filtered.length === 0 && <EmptyState icon={Search} title={t("customers.noMatchesTitle")} description={t("customers.noMatchesDescription")} className="border-0" />}
          {pageItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">{t("customers.table.name")}</th>
                    <th className="px-4 py-3">{t("customers.table.contact")}</th>
                    <th className="px-4 py-3 text-right">{t("customers.table.bookings")}</th>
                    <th className="px-4 py-3 text-right">{t("customers.table.spent")}</th>
                    <th className="px-4 py-3">{t("customers.table.last")}</th>
                    <th className="px-4 py-3">{t("customers.table.next")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((customer) => (
                    <tr key={customer.key} className={`border-b last:border-0 hover:bg-muted/40 ${OPEN_CLASS}`} {...openProps(() => setSelected(customer))}>
                      <td className="px-4 py-3 font-medium">{customer.name}</td>
                      <td className="px-4 py-3">{customer.contact ?? dash}</td>
                      <td className="px-4 py-3 text-right">{customer.bookings.length}</td>
                      <td className="px-4 py-3 text-right">{formatPeso(customer.spent)}</td>
                      <td className="px-4 py-3">{customer.lastVisit ? format.date(customer.lastVisit) : dash}</td>
                      <td className="px-4 py-3">{customer.next ? format.date(customer.next) : dash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <Pagination page={page} totalPages={totalPages} totalItems={totalItems} pageSize={PAGE_SIZE} onPageChange={setPage} />
      <CustomerDetailDialog customer={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
