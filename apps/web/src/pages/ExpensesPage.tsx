import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt, CalendarDays, Layers, Wallet, Search } from "lucide-react";
import { Card, CardContent, Badge, PageHeader, EmptyState, Skeleton, StatCard, FilterBar, Input, Pagination, cn } from "@isnabero/ui";
import { EXPENSE_CATEGORY_VALUES, todayYmd, useExpenses, type ExpenseCategory } from "@isnabero/module-expenses";
import { supabase } from "@/lib/supabase";
import { useBusinessStore } from "@/stores/business-store";
import { usePermission } from "@/hooks/use-permission";
import { usePagination } from "@/hooks/use-pagination";
import { ExportButton } from "@/components/ExportButton";
import { expenseRows } from "@/lib/export-rows";
import { AddExpenseModal } from "@/components/expenses/AddExpenseModal";
import { EditExpenseButton } from "@/components/expenses/EditExpenseButton";
import { VoidExpenseButton } from "@/components/expenses/VoidExpenseButton";
import { computeExpenseStats } from "@/components/expenses/expense-stats";
import { useFormat, useLabels, useT } from "@/i18n";
import { formatPeso } from "@/lib/money";
import { getCoreRepository } from "@/lib/repositories/get-repository";
import { ExpenseDetailDialog } from "@/components/details/ExpenseDetailDialog";
import { OPEN_CLASS, openProps } from "@/components/details/open-props";

const CATEGORY_TABS = ["all", ...EXPENSE_CATEGORY_VALUES] as const;
const CATEGORY_BADGE_VARIANT = { rent: "info", utilities: "warning", supplies: "default", salaries: "success", other: "secondary" } as const;
const PAGE_SIZE = 10;

const peso = formatPeso;

export default function ExpensesPage() {
  const { t } = useT();
  const labels = useLabels();
  const f = useFormat(); // f.date reads calendar-day strings as local days
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const canManage = usePermission("expenses.manage");

  const [showVoided, setShowVoided] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ExpenseCategory>("all");

  const { data: expenses = [], isLoading } = useExpenses(supabase, businessId, { includeVoided: showVoided });

  // names for "recorded by" (the expense only stores the employee id); shares the Employees page cache
  const { data: employees = [] } = useQuery({
    queryKey: ["employees", businessId],
    queryFn: () => getCoreRepository(supabase).listEmployees(businessId),
    enabled: Boolean(businessId),
  });
  const employeeName = (id: string | null) => (id ? employees.find((employee) => employee.id === id)?.fullName ?? null : null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return expenses.filter((expense) => {
      const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter;
      const matchesSearch = term === "" || expense.description.toLowerCase().includes(term) || (expense.notes ?? "").toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [expenses, search, categoryFilter]);

  const { page, setPage, totalPages, pageItems, totalItems } = usePagination(filtered, PAGE_SIZE);

  // Stats ignore voided expenses whatever the "Show voided" toggle says
  const stats = useMemo(() => computeExpenseStats(expenses, todayYmd()), [expenses]);

  return (
    <div className="space-y-6">
      <PageHeader icon={Receipt} title={t("expenses.title")} description={t("expenses.description")} action={
          <div className="flex items-center gap-2">
            <ExportButton title="Expenses" filenamePrefix="expenses" moneyColumns={["Amount"]} withDateRange hint={t("expenses.exportHint")} disabled={filtered.length === 0} buildRows={(range) => expenseRows(filtered, range)} />
            {canManage && <AddExpenseModal businessId={businessId} />}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("expenses.stats.month")} value={peso(stats.monthTotal)} icon={CalendarDays} accent="warning" isLoading={isLoading} />
        <StatCard label={t("expenses.stats.allTime")} value={peso(stats.allTimeTotal)} icon={Wallet} accent="default" isLoading={isLoading} />
        <StatCard
          label={t("expenses.stats.topCategory")}
          value={stats.topCategory ? labels.expenseCategory(stats.topCategory.category) : "—"}
          helpText={stats.topCategory ? peso(stats.topCategory.total) : undefined}
          icon={Layers}
          accent="info"
          isLoading={isLoading}
        />
      </div>

      {/* Always rendered: the "Show voided" toggle lives here */}
      <FilterBar>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 overflow-x-auto rounded-lg border bg-background p-1">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCategoryFilter(tab)}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  categoryFilter === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {tab === "all" ? t("common.all") : labels.expenseCategory(tab)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={showVoided} onChange={(event) => setShowVoided(event.target.checked)} className="h-4 w-4 rounded border-input" />
            {t("expenses.showVoided")}
          </label>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("expenses.searchPlaceholder")} aria-label={t("expenses.searchLabel")} value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
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

          {!isLoading && expenses.length === 0 && (
            <EmptyState icon={Receipt} title={t("expenses.empty.title")} description={canManage ? t("expenses.empty.descriptionManage") : t("expenses.empty.descriptionReadonly")} className="border-0" />
          )}

          {!isLoading && expenses.length > 0 && filtered.length === 0 && <EmptyState icon={Search} title={t("expenses.noMatches.title")} description={t("expenses.noMatches.description")} className="border-0" />}

          {!isLoading && pageItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">{t("expenses.table.date")}</th>
                    <th className="px-4 py-3">{t("expenses.table.category")}</th>
                    <th className="px-4 py-3">{t("expenses.table.description")}</th>
                    <th className="px-4 py-3">{t("expenses.table.method")}</th>
                    <th className="px-4 py-3">{t("expenses.table.recordedBy")}</th>
                    <th className="px-4 py-3 text-right">{t("expenses.table.amount")}</th>
                    {canManage && <th className="px-4 py-3 text-right">{t("expenses.table.actions")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((expense) => (
                    <tr key={expense.id} {...openProps(() => setDetailId(expense.id))} title={t("details.open", { name: expense.description })} className={cn("border-b transition-colors last:border-0 hover:bg-accent/50", OPEN_CLASS, expense.voidedAt && "opacity-50")}>
                      <td className="whitespace-nowrap px-4 py-3">{f.date(expense.expenseDate)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={CATEGORY_BADGE_VARIANT[expense.category]}>{labels.expenseCategory(expense.category)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{expense.description}</p>
                        {expense.notes && <p className="text-xs text-muted-foreground">{expense.notes}</p>}
                      </td>
                      <td className="px-4 py-3">{labels.method(expense.method)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{employeeName(expense.recordedBy) ?? "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                        {peso(expense.amount)}
                        {expense.voidedAt && (
                          <Badge variant="destructive" className="ml-2">
                            {t("expenses.voided")}
                          </Badge>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            {!expense.voidedAt && <EditExpenseButton businessId={businessId} expense={expense} />}
                            {!expense.voidedAt && <VoidExpenseButton businessId={businessId} expenseId={expense.id} label={`${expense.description} ${peso(expense.amount)}`} />}
                          </div>
                        </td>
                      )}
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
      <ExpenseDetailDialog expense={expenses.find((expense) => expense.id === detailId) ?? null} recordedByName={employeeName(expenses.find((expense) => expense.id === detailId)?.recordedBy ?? null)} onClose={() => setDetailId(null)} />
    </div>
  );
}
