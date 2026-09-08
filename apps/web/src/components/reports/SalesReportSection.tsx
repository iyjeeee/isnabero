import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, Wallet, Receipt, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@isnabero/ui";
import { supabase } from "@/lib/supabase";
import { getReportsRepository } from "@/lib/repositories/get-reports-repository";
import { CHART_COLORS, METHOD_COLORS } from "@/lib/chart-colors";

interface SalesReportSectionProps {
  businessId: string;
}

export function SalesReportSection({ businessId }: SalesReportSectionProps) {
  const repository = getReportsRepository(supabase);
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "sales", businessId],
    queryFn: () => repository.getSalesReport(businessId, 14),
    enabled: Boolean(businessId),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          Sales Report
          <span className="text-sm font-normal text-muted-foreground">— last 14 days</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && <Skeleton className="h-64 w-full" />}
        {!isLoading && data && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Wallet className="h-4 w-4 text-success" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                  <p className="font-semibold">₱{data.totalRevenue.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Receipt className="h-4 w-4 text-info" />
                <div>
                  <p className="text-xs text-muted-foreground">Transactions</p>
                  <p className="font-semibold">
                    {data.transactionCount} <span className="text-xs font-normal text-muted-foreground">(avg ₱{data.averageSale.toFixed(2)})</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Ban className="h-4 w-4 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">Voided</p>
                  <p className="font-semibold">{data.voidedCount}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="h-64 lg:col-span-2">
                <p className="mb-2 text-sm font-medium text-muted-foreground">Daily revenue</p>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={data.dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value: string) => value.slice(5)}
                      tick={{ fontSize: 11 }}
                      className="fill-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" width={40} />
                    <Tooltip formatter={(value: number) => [`₱${value.toFixed(2)}`, "Revenue"]} labelFormatter={(label) => `Date: ${label}`} />
                    <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="h-64">
                <p className="mb-2 text-sm font-medium text-muted-foreground">By payment method</p>
                {data.methodBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sales in this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="90%">
                    <PieChart>
                      <Pie data={data.methodBreakdown} dataKey="value" nameKey="label" innerRadius={40} outerRadius={70} paddingAngle={2}>
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
