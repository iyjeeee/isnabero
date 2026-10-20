import { BarChart3 } from "lucide-react";
import { useT } from "@/i18n";
import { PageHeader } from "@isnabero/ui";
import { useBusinessStore } from "@/stores/business-store";
import { useBusinessModules } from "@/hooks/use-business-modules";
import { SalesReportSection } from "@/components/reports/SalesReportSection";
import { BookingReportSection } from "@/components/reports/BookingReportSection";
import { ProfitReportSection } from "@/components/reports/ProfitReportSection";
import { useCan } from "@/hooks/use-permission";
import { CatalogReportSection } from "@/components/reports/CatalogReportSection";

// Each report renders only if its module is enabled for this business — same "only show what's
// relevant" pattern as the sidebar itself. Full-width sections since charts need real room, unlike
// the small preview cards this page used before real report data existed.
export default function ReportsPage() {
  const { t } = useT();
  const businessId = useBusinessStore((state) => state.businessId) ?? "";
  const { data: enabledModules = [] } = useBusinessModules(businessId);
  const can = useCan();

  const hasAnyReport = enabledModules.includes("pos") || enabledModules.includes("booking") || enabledModules.includes("catalog") || enabledModules.includes("expenses");

  return (
    <div className="space-y-5">
      <PageHeader icon={BarChart3} title={t("reports.title")} description={t("reports.description")} />

      {!hasAnyReport && (
        <p className="text-sm text-muted-foreground">{t("reports.empty")}</p>
      )}

      {enabledModules.includes("expenses") && can("expenses.view") && <ProfitReportSection businessId={businessId} />}
      {enabledModules.includes("pos") && <SalesReportSection businessId={businessId} />}
      {enabledModules.includes("booking") && <BookingReportSection businessId={businessId} />}
      {enabledModules.includes("catalog") && <CatalogReportSection businessId={businessId} />}
    </div>
  );
}
