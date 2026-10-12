import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, Wallet, Receipt, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Skeleton, TrendBadge } from "@isnabero/ui";
import { supabase } from "@/lib/supabase";
import { getReportsRepository } from "@/lib/repositories/get-reports-repository";
import { useT, useFormat, useLabels } from "@/i18n";
import { CHART_COLORS, METHOD_COLORS } from "@/lib/chart-colors";
import { ExportButton } from "@/components/ExportButton";
import { salesReportRows } from "@/lib/export-rows";
import { computePercentChange } from "@/lib/percent-change";

interface SalesReportSectionProps {
  businessId: string;
}

export function SalesReportSection({ businessId }: SalesReportSectionProps) {
  const { t } = useT();
  const format = useFormat();
  const labels = useLabels();
  const repository = getReportsRepository(supabase);
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "sales", businessId],
    queryFn: () => repository.getSalesReport(businessId, 14),
    enabled: Boolean(businessId),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          {t("reports.sales.title")}
          <span className="text-sm font-normal text-muted-foreground">{t("reports.last14Days")}</span>
        </CardTitle>
        <ExportButton title="Sales Report (last 14 days)" filenamePrefix="sales-report" moneyColumns={["Revenue"]} disabled={!data} buildRows={() => salesReportRows(data?.dailyRevenue ?? [])} />
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && <Skeleton className="h-64 w-full" />}
        {!isLoading && data && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Wallet className="h-4 w-4 text-success" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("reports.sales.totalRevenue")}</p>
                  <p className="font-semibold">₱{data.totalRevenue.toFixed(2)}</p>
                  <TrendBadge percentChange={computePercentChange(data.totalRevenue, data.previousPeriodRevenue)} className="mt-0.5" />
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Receipt className="h-4 w-4 text-info" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("reports.sales.transactions")}</p>
                  <p className="font-semibold">
                    {data.transactionCount} <span className="text-xs font-normal text-muted-foreground">{t("reports.sales.average", { amount: `₱${data.averageSale.toFixed(2)}` })}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Ban className="h-4 w-4 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("reports.sales.voided")}</p>
                  <p className="font-semibold">{data.voidedCount}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="h-64 lg:col-span-2">
                <p className="mb-2 text-sm font-medium text-muted-foreground">{t("reports.sales.dailyRevenue")}</p>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={data.dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value: string) => format.monthDay(value)}
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" width={40} />
                    <Tooltip formatter={(value: number) => [`₱${value.toFixed(2)}`, t("reports.sales.revenue")]} labelFormatter={(label) => t("reports.date", { date: format.date(String(label)) })} />
                    <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="h-64">
                <p className="mb-2 text-sm font-medium text-muted-foreground">{t("reports.sales.byMethod")}</p>
                {data.methodBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("reports.sales.noSales")}</p>
                ) : (
                  <ResponsiveContainer width="100%" height="90%">
                    <PieChart>
                      <Pie data={data.methodBreakdown.map((entry) => ({ ...entry, name: labels.method(entry.label) }))} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                        {data.methodBreakdown.map((entry) => (
                          <Cell key={entry.label} fill={METHOD_COLORS[entry.label] ?? CHART_COLORS[4]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `₱${value.toFixed(2)}`} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
