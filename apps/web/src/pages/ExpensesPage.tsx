import { useMemo, useState } from "react";
import { Receipt, CalendarDays, Layers, Wallet, Search } from "lucide-react";
import { Card, CardContent, Badge, PageHeader, EmptyState, Skeleton, StatCard, FilterBar, Input, Pagination, cn } from "@isnabero/ui";
import { EXPENSE_CATEGORIES, getExpenseCategoryLabel, todayYmd, useExpenses, type ExpenseCategory } from "@isnabero/module-expenses";
import { supabase } from "@/lib/supabase";
import { useBusinessStore } from "@/stores/business-store";
import { usePermission } from "@/hooks/use-permission";
import { usePagination } from "@/hooks/use-pagination";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { expenseRows } from "@/lib/export-rows";
import { AddExpenseModal } from "@/components/expenses/AddExpenseModal";
import { VoidExpenseButton } from "@/components/expenses/VoidExpenseButton";
import { computeExpenseStats } from "@/components/expenses/expense-stats";

const CATEGORY_TABS = [{ value: "all", label: "All" }, ...EXPENSE_CATEGORIES] as const;
const CATEGORY_BADGE_VARIANT = { rent: "info", utilities: "warning", supplies: "default", salaries: "success", other: "secondary" } as const;
const METHOD_LABELS = { cash: "Cash", gcash: "GCash", bank_transfer: "Bank transfer", other: "Other" } as const;
const PAGE_SIZE = 10;

const peso = (amount: number) => `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Dates are calendar days (YYYY-MM-DD); format without going through a timezone-shifting Date parse
const formatDay = (ymd: string) => {
  const [year, month, day] = ymd.split("-").map(Number) as [number, number, number];
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export default function ExpensesPage() {
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const canManage = usePermission("expenses.manage");

  const [showVoided, setShowVoided] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ExpenseCategory>("all");

  const { data: expenses = [], isLoading } = useExpenses(supabase, businessId, { includeVoided: showVoided });

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
      <PageHeader icon={Receipt} title="Expenses" description="Money your business spends — rent, utilities, supplies and more." action={
          <div className="flex items-center gap-2">
            <ExportCsvButton filenamePrefix="expenses" withDateRange hint="Uses the category filter, search and “Show voided” setting currently applied." disabled={filtered.length === 0} buildRows={(range) => expenseRows(filtered, range)} />
            {canManage && <AddExpenseModal businessId={businessId} />}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Spent This Month" value={peso(stats.monthTotal)} icon={CalendarDays} accent="warning" isLoading={isLoading} />
        <StatCard label="All-Time Spend" value={peso(stats.allTimeTotal)} icon={Wallet} accent="default" isLoading={isLoading} />
        <StatCard
          label="Top Category This Month"
          value={stats.topCategory ? getExpenseCategoryLabel(stats.topCategory.category) : "—"}
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
                key={tab.value}
                type="button"
                onClick={() => setCategoryFilter(tab.value)}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  categoryFilter === tab.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
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
          <Input placeholder="Search description or notes…" aria-label="Search expenses" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
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
            <EmptyState icon={Receipt} title="No expenses yet" description={canManage ? "Use “Add expense” to record your first one." : "Expenses recorded by an owner or admin will show up here."} className="border-0" />
          )}

          {!isLoading && expenses.length > 0 && filtered.length === 0 && <EmptyState icon={Search} title="No matches" description="Try a different search term or category." className="border-0" />}

          {!isLoading && pageItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Paid with</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((expense) => (
                    <tr key={expense.id} className={cn("border-b transition-colors last:border-0 hover:bg-accent/50", expense.voidedAt && "opacity-50")}>
                      <td className="whitespace-nowrap px-4 py-3">{formatDay(expense.expenseDate)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={CATEGORY_BADGE_VARIANT[expense.category]}>{getExpenseCategoryLabel(expense.category)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{expense.description}</p>
                        {expense.notes && <p className="text-xs text-muted-foreground">{expense.notes}</p>}
                      </td>
                      <td className="px-4 py-3">{METHOD_LABELS[expense.method]}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                        {peso(expense.amount)}
                        {expense.voidedAt && (
                          <Badge variant="destructive" className="ml-2">
                            Voided
                          </Badge>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
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
    </div>
  );
}
