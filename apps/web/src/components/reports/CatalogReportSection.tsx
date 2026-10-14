import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { LayoutGrid, PackageCheck, PackageX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@isnabero/ui";
import { supabase } from "@/lib/supabase";
import { getReportsRepository } from "@/lib/repositories/get-reports-repository";
import { useT } from "@/i18n";
import { CHART_COLORS } from "@/lib/chart-colors";
import { formatPeso } from "@/lib/money";

interface CatalogReportSectionProps {
  businessId: string;
}

export function CatalogReportSection({ businessId }: CatalogReportSectionProps) {
  const { t } = useT();
  const repository = getReportsRepository(supabase);
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "catalog", businessId],
    queryFn: () => repository.getCatalogReport(businessId),
    enabled: Boolean(businessId),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LayoutGrid className="h-4 w-4 text-primary" />
          {t("reports.catalog.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && <Skeleton className="h-64 w-full" />}
        {!isLoading && data && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <LayoutGrid className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("reports.catalog.totalOfferings")}</p>
                  <p className="font-semibold">{data.totalOfferings}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <PackageCheck className="h-4 w-4 text-success" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("reports.catalog.available")}</p>
                  <p className="font-semibold">{data.availableCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <PackageX className="h-4 w-4 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">{t("reports.catalog.soldOut")}</p>
                  <p className="font-semibold">{data.soldOutCount}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">{t("reports.catalog.topSelling")}</p>
              {data.topOfferings.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("reports.catalog.noSales")}</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.topOfferings} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" width={110} />
                      <Tooltip formatter={(value: number, key: string) => (key === "quantitySold" ? [value, t("reports.catalog.qtySold")] : [formatPeso(value), t("reports.catalog.revenue")])} />
                      <Bar dataKey="quantitySold" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
