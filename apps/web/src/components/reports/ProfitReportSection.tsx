import { useQuery } from "@tanstack/react-query";
import { PiggyBank, Wallet, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Skeleton, TrendBadge } from "@isnabero/ui";
import { supabase } from "@/lib/supabase";
import { getReportsRepository } from "@/lib/repositories/get-reports-repository";
import { useT, useLabels } from "@/i18n";
import { computePercentChange } from "@/lib/percent-change";
import { formatPeso } from "@/lib/money";

// ProfitReportSection: revenue minus expenses for the last 14 days, with where the money went (owner/admin only)
export function ProfitReportSection({ businessId }: { businessId: string }) {
  const { t } = useT();
  const labels = useLabels();
  const repository = getReportsRepository(supabase);
  const { data, isLoading } = useQuery({ queryKey: ["reports", "profit", businessId], queryFn: () => repository.getProfitReport(businessId, 14), enabled: Boolean(businessId) });

  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <PiggyBank className="h-4 w-4 text-primary" />
          {t("reports.profit.title")}
          <span className="text-sm font-normal text-muted-foreground">{t("reports.last14Days")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading && <Skeleton className="h-32 w-full" />}
        {data && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Wallet className="h-4 w-4 text-success" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("reports.profit.revenue")}</p>
                  <p className="font-semibold">{formatPeso(data.revenue)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Receipt className="h-4 w-4 text-warning" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("reports.profit.expenses")}</p>
                  <p className="font-semibold">−{formatPeso(data.expenses)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <PiggyBank className={`h-4 w-4 ${data.profit < 0 ? "text-destructive" : "text-primary"}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{data.profit < 0 ? t("reports.profit.loss") : t("reports.profit.profit")}</p>
                  <p className={`font-semibold ${data.profit < 0 ? "text-destructive" : ""}`} data-testid="profit-total">
                    {data.profit < 0 ? "−" : ""}
                    {formatPeso(Math.abs(data.profit))}
                  </p>
                  <TrendBadge percentChange={data.previousProfit > 0 ? computePercentChange(data.profit, data.previousProfit) : null} className="mt-0.5" />
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">{t("reports.profit.whereItWent")}</p>
              {data.expensesByCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("reports.profit.noExpenses")}</p>
              ) : (
                <ul className="space-y-2">
                  {data.expensesByCategory.map((slice) => (
                    <li key={slice.label} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{labels.expenseCategory(slice.label)}</span>
                        <span className="font-medium">{formatPeso(slice.value)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-warning" style={{ width: `${data.expenses > 0 ? Math.round((slice.value / data.expenses) * 100) : 0}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
